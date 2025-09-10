import { getFs } from "../adapter/fs";
import { getDirHandle } from "../shared.migrated";
import { basename, joinPath, normalizeSegments, parentOf } from "./path";

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
  destPath: string,
  options: FileUploadBaseOptions & PickerOptions = {},
) {
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

      resolve(await uploadFilesToDirectory(destPath, files, options));
    });

    input.click();
  });
}

export async function uploadFilesToDirectory(destPath: string, files: File[], options: FileUploadBaseOptions = {}) {
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

    const basePath = normalizeSegments(destPath || "").join("/");
    let finalPath = basePath ? joinPath(basePath, destRel) : destRel;

    try {
      // Node/ZenFS path (migrated helpers)
      if (overwrite === "skip" && (await fileExists(finalPath))) {
        errors.push(`File exists, skipped: ${finalPath}`);
        continue;
      }

      if (overwrite === "rename" && (await fileExists(finalPath))) {
        const renamed = await findAvailableNameMigrated(finalPath);
        if (!renamed) {
          errors.push(`File exists, cannot rename: ${finalPath}`);
          continue;
        }
        finalPath = renamed;
      }

      const dirAbs = await getDirHandle(parentOf(finalPath), true);
      const absPath = "/" + joinPath(dirAbs, basename(finalPath));

      const fs = await getFs();
      const data = await file.arrayBuffer();
      await fs.promises.writeFile(absPath, new Uint8Array(data));

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

async function fileExists(path: string): Promise<boolean> {
  const fs = await getFs();
  const dirAbs = await getDirHandle(parentOf(path), false);
  const absPath = "/" + joinPath(dirAbs, basename(path));
  try {
    const st = await fs.promises.stat(absPath);
    return st.isFile();
  } catch (e: any) {
    if (e && (e.code === "ENOENT" || e.name === "NotFoundError")) return false;
    return false;
  }
}

async function findAvailableNameMigrated(path: string): Promise<string | null> {
  const dirPath = parentOf(path);
  const base = basename(path);
  const { name, ext } = splitExt(base);

  for (let i = 1; i < 1000; i++) {
    const candidate = joinPath(dirPath, `${name} (${i})${ext}`);
    if (!(await fileExists(candidate))) return candidate;
  }

  return null;
}

function splitExt(name: string): { name: string; ext: string } {
  const i = name.lastIndexOf(".");
  return i === -1 ? { name, ext: "" } : { name: name.slice(0, i), ext: name.slice(i) };
}
