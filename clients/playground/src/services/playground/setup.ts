import { getDirectoryHandle, getOPFSRoot } from "@pstdio/opfs-utils";

/**
 * Setup the OPFS `playground` directory with demo files.
 * Currently creates a single README.md if it does not exist.
 */
export type SetupOptions = {
  /** Directory name under OPFS root. Defaults to `playground`. */
  folderName?: string;
  /** README content to write when creating the file. */
  readmeContent?: string;
  /** If true, overwrite README content even if it exists. */
  overwrite?: boolean;
};

export const DEFAULT_README_CONTENT = `# Playground

Welcome! This is your Kaset playground folder.

What's here:
- README.md (this file) — created by the setup script as a starting point.

Tips:
- Files you add here live in the browser's Origin Private File System (OPFS).
- Use the file explorer to browse; select a file to preview it.
- You can safely delete or edit this file.
`;

/**
 * Ensures a `playground` directory exists in OPFS and provides a README.md.
 *
 * Returns information about whether files were created.
 */
export async function setupPlayground(options: SetupOptions = {}) {
  const folderName = options.folderName?.trim() || "playground";
  const readmeContent = options.readmeContent ?? DEFAULT_README_CONTENT;
  const overwrite = Boolean(options.overwrite);

  // Ensure the target directory exists. Fallback to creating the path if needed.
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await getDirectoryHandle(folderName);
  } catch (err: any) {
    // If the utility does not create missing directories, create them here.
    if (err?.name === "NotFoundError" || err?.code === 404) {
      const root = await getOPFSRoot();
      const parts = folderName.split("/").filter(Boolean);

      let current = root;
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: true });
      }

      dir = current;
    } else {
      throw err;
    }
  }

  let createdReadme = false;

  // Create README.md if it does not exist, or overwrite when requested.
  let needsWrite = overwrite;

  if (!overwrite) {
    try {
      await dir.getFileHandle("README.md");
    } catch (err: any) {
      if (err?.name === "NotFoundError" || err?.code === 404) {
        needsWrite = true;
      } else {
        throw err;
      }
    }
  }

  if (needsWrite) {
    const fh = await dir.getFileHandle("README.md", { create: true });
    const writable = await fh.createWritable();

    await writable.write(readmeContent);
    await writable.close();

    createdReadme = true;
  }

  return {
    folderName,
    createdReadme,
  };
}

export default setupPlayground;
