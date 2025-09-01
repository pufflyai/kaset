export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  const storage = (typeof navigator !== "undefined" ? navigator.storage : undefined) as StorageManager | undefined;
  const getDir = storage?.getDirectory as undefined | (() => Promise<FileSystemDirectoryHandle>);

  if (typeof getDir !== "function") {
    throw new Error("OPFS is not supported (navigator.storage.getDirectory unavailable).");
  }

  return getDir.call(storage);
}

export async function getDirectoryHandle(path = ""): Promise<FileSystemDirectoryHandle> {
  const root = await getOPFSRoot();

  if (!path) return root;

  const segments = path.replace(/\\/g, "/").split("/").filter(Boolean);

  let dir = root;

  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create: false });
  }

  return dir;
}
