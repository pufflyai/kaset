import { PLUGIN_ROOT } from "@/constant";

type DirectoryHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

const getRootDirectory = async (): Promise<DirectoryHandle> => {
  const storage = navigator.storage;
  if (!storage || typeof storage.getDirectory !== "function") {
    throw new Error("File System Access API is not available in this environment.");
  }

  return storage.getDirectory();
};

const splitPath = (path: string) =>
  path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

const resolveDirectoryHandle = async (path: string): Promise<DirectoryHandle> => {
  const segments = splitPath(path);
  let current = await getRootDirectory();

  for (const segment of segments) {
    try {
      current = await current.getDirectoryHandle(segment);
    } catch (error) {
      if ((error as DOMException | undefined)?.name === "NotFoundError") {
        throw new Error(`Directory not found: ${path}`);
      }
      throw error;
    }
  }

  return current;
};

type DirectoryEntry = [string, FileSystemHandle];

const iterateDirectoryEntries = async function* (handle: DirectoryHandle): AsyncIterable<DirectoryEntry> {
  const anyHandle = handle as unknown as {
    entries?: () => AsyncIterable<DirectoryEntry>;
    values?: () => AsyncIterable<FileSystemHandle>;
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<DirectoryEntry>;
  };

  if (typeof anyHandle.entries === "function") {
    for await (const entry of anyHandle.entries()) {
      yield entry;
    }
    return;
  }

  const asyncIterator = anyHandle[Symbol.asyncIterator];
  if (typeof asyncIterator === "function") {
    for await (const entry of asyncIterator.call(anyHandle)) {
      yield entry;
    }
    return;
  }

  const values = anyHandle.values;
  if (typeof values === "function") {
    for await (const entryHandle of values.call(anyHandle)) {
      const name = (entryHandle as FileSystemHandle).name;
      yield [name, entryHandle];
    }
    return;
  }

  throw new Error("FileSystemDirectoryHandle iteration is not supported in this browser.");
};

type TarEntry = {
  path: string;
  isDirectory: boolean;
  content?: ArrayBuffer;
};

const collectEntries = async (options: { handle: DirectoryHandle; basePath: string; entries: TarEntry[] }) => {
  const { handle, basePath, entries } = options;

  for await (const [name, entry] of iterateDirectoryEntries(handle)) {
    const nextPath = basePath ? `${basePath}/${name}` : name;

    if (entry.kind === "file") {
      const fileHandle = entry as FileHandle;
      const file = await fileHandle.getFile();
      const content = await file.arrayBuffer();
      entries.push({ path: nextPath, isDirectory: false, content });
      continue;
    }

    if (entry.kind === "directory") {
      const directoryHandle = entry as DirectoryHandle;
      entries.push({ path: `${nextPath}/`, isDirectory: true });
      await collectEntries({ handle: directoryHandle, basePath: nextPath, entries });
    }
  }
};

const writeOctal = (value: number, size: number) => {
  const octal = value.toString(8);
  const padded = octal.padStart(size - 1, "0");
  return `${padded}\0`;
};

const textEncoder = new TextEncoder();

const setString = (buffer: Uint8Array, offset: number, length: number, value: string) => {
  const bytes = textEncoder.encode(value);
  buffer.set(bytes.slice(0, length), offset);
};

const setPath = (header: Uint8Array, path: string) => {
  const bytes = textEncoder.encode(path);
  if (bytes.length <= 100) {
    header.set(bytes, 0);
    return;
  }

  const separatorIndex = path.lastIndexOf("/");
  if (separatorIndex === -1) throw new Error(`Path too long for tar header: ${path}`);

  const name = path.slice(separatorIndex + 1);
  const prefix = path.slice(0, separatorIndex);

  const nameBytes = textEncoder.encode(name);
  const prefixBytes = textEncoder.encode(prefix);

  if (nameBytes.length > 100 || prefixBytes.length > 155) {
    throw new Error(`Path too long for tar header: ${path}`);
  }

  header.set(nameBytes, 0);
  header.set(prefixBytes, 345);
};

const createTarBlob = (entries: TarEntry[]) => {
  const blocks: Uint8Array[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const entry of entries) {
    const header = new Uint8Array(512);
    setPath(header, entry.path);

    const mode = entry.isDirectory ? "0000755" : "0000644";
    setString(header, 100, 8, `${mode}\0`);
    setString(header, 108, 8, writeOctal(0, 8));
    setString(header, 116, 8, writeOctal(0, 8));

    const size = entry.isDirectory ? 0 : (entry.content?.byteLength ?? 0);
    setString(header, 124, 12, writeOctal(size, 12));
    setString(header, 136, 12, writeOctal(now, 12));

    // Checksum placeholder (spaces)
    for (let i = 148; i < 156; i += 1) {
      header[i] = 32;
    }

    header[156] = entry.isDirectory ? 53 : 48; // '5' or '0'
    setString(header, 257, 6, "ustar\0");
    setString(header, 263, 2, "00");

    const checksum = header.reduce((acc, byte) => acc + byte, 0);
    setString(header, 148, 8, writeOctal(checksum, 8));

    blocks.push(header);

    if (!entry.isDirectory && entry.content) {
      const data = new Uint8Array(entry.content);
      blocks.push(data);

      const remainder = data.byteLength % 512;
      if (remainder > 0) {
        blocks.push(new Uint8Array(512 - remainder));
      }
    }
  }

  // End of archive: two empty blocks
  blocks.push(new Uint8Array(512));
  blocks.push(new Uint8Array(512));

  return new Blob(blocks, { type: "application/x-tar" });
};

export const downloadPluginFolder = async (pluginId: string) => {
  if (!pluginId) throw new Error("downloadPluginFolder requires a plugin id");

  const pluginDirPath = `${PLUGIN_ROOT}/${pluginId}`;
  const pluginDirectory = await resolveDirectoryHandle(pluginDirPath);

  const entries: TarEntry[] = [{ path: `${pluginId}/`, isDirectory: true }];
  await collectEntries({ handle: pluginDirectory, basePath: pluginId, entries });

  const blob = createTarBlob(entries);
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pluginId}.tar`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const deletePlugin = async (pluginId: string) => {
  if (!pluginId) throw new Error("deletePlugin requires a plugin id");

  const pluginsRootHandle = await resolveDirectoryHandle(PLUGIN_ROOT);

  try {
    await pluginsRootHandle.removeEntry(pluginId, { recursive: true });
  } catch (error) {
    if ((error as DOMException | undefined)?.name === "NotFoundError") {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    throw error;
  }
};
