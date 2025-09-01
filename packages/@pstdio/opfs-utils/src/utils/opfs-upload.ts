export interface FileUploadBaseOptions {
  destSubdir?: string;
  pathMapper?: (file: File) => string;
  overwrite?: "replace" | "skip" | "rename";
  onProgress?: (info: { index: number; total: number; filename: string; destPath: string }) => void;
}

export interface PickerOptions {
  /** Accepted file types. Default: "" (allow all) */
  accept?: string;
  /** Allow selecting multiple files. Default: true */
  multiple?: boolean;
}

export interface FileUploadResult {
  success: boolean;
  uploadedFiles: string[];
  errors: string[];
}

export async function pickAndUploadFilesToDirectory(
  destRoot: FileSystemDirectoryHandle,
  options: FileUploadBaseOptions & PickerOptions = {},
): Promise<FileUploadResult> {
  if (typeof document === "undefined") {
    throw new Error("DOM not available; use uploadFilesToDirectory instead.");
  }

  const { accept = "", multiple = true } = options;

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;

    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (!files.length) {
        resolve({ success: false, uploadedFiles: [], errors: ["No files selected"] });
        return;
      }

      resolve(await uploadFilesToDirectory(destRoot, files, options));
    });

    input.click();
  });
}

export async function uploadFilesToDirectory(
  destRoot: FileSystemDirectoryHandle,
  files: File[],
  options: FileUploadBaseOptions = {},
): Promise<FileUploadResult> {
  const uploadedFiles: string[] = [];
  const errors: string[] = [];

  const total = files.length;
  const overwrite = options.overwrite ?? "replace";

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const destRel = resolvePath(file, options);

    if (destRel == null) {
      errors.push(`Invalid destination for ${file.name}`);
      continue;
    }

    let finalPath = destRel;

    try {
      if (overwrite === "skip" && (await fileExists(destRoot, destRel))) {
        errors.push(`File exists, skipped: ${destRel}`);
        continue;
      }

      if (overwrite === "rename" && (await fileExists(destRoot, destRel))) {
        const renamed = await findAvailableName(destRoot, destRel);
        if (!renamed) {
          errors.push(`File exists, cannot rename: ${destRel}`);
          continue;
        }
        finalPath = renamed;
      }

      const dir = await getDirHandle(destRoot, parentOf(finalPath), true);
      const fh = await dir.getFileHandle(basename(finalPath), { create: true });
      const w = await fh.createWritable();

      const data = await file.arrayBuffer();
      await w.write(data);
      await w.close();

      uploadedFiles.push(finalPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Failed to upload ${file.name}: ${msg}`);
    } finally {
      options.onProgress?.({ index: i, total, filename: file.name, destPath: finalPath });
    }
  }

  return { success: errors.length === 0, uploadedFiles, errors };
}

function resolvePath(file: File, options: FileUploadBaseOptions): string | null {
  const { pathMapper, destSubdir } = options;

  let raw: string;
  if (pathMapper) {
    raw = pathMapper(file);
  } else if (destSubdir) {
    raw = joinPath(destSubdir, file.name);
  } else {
    raw = file.name;
  }

  const segs = normalizeSegments(raw);
  return segs.join("/");
}

async function fileExists(root: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  try {
    const dir = await getDirHandle(root, parentOf(path), false);
    await dir.getFileHandle(basename(path), { create: false });
    return true;
  } catch {
    return false;
  }
}

async function findAvailableName(root: FileSystemDirectoryHandle, path: string): Promise<string | null> {
  const dirPath = parentOf(path);
  const base = basename(path);
  const { name, ext } = splitExt(base);

  for (let i = 1; i < 1000; i++) {
    const candidate = joinPath(dirPath, `${name} (${i})${ext}`);
    if (!(await fileExists(root, candidate))) return candidate;
  }

  return null;
}

async function getDirHandle(root: FileSystemDirectoryHandle, path: string, create: boolean) {
  if (!path) return root;

  let cur = root;
  for (const seg of normalizeSegments(path)) {
    cur = await cur.getDirectoryHandle(seg, { create });
  }
  return cur;
}

function normalizeSegments(p: string): string[] {
  const out: string[] = [];

  for (const part of p.split("/")) {
    const s = part.trim();
    if (!s || s === ".") continue;
    if (s === "..") {
      if (out.length) out.pop();
      continue;
    }
    out.push(s);
  }

  return out;
}

function joinPath(a: string, b: string) {
  return normalizeSegments(`${a}/${b}`).join("/");
}

function parentOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

function splitExt(name: string): { name: string; ext: string } {
  const i = name.lastIndexOf(".");
  return i === -1 ? { name, ext: "" } : { name: name.slice(0, i), ext: name.slice(i) };
}
