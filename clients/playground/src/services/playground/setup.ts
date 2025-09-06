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
  /** Optional initial todo.md content; created if file missing. */
  todoContent?: string;
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

export const DEFAULT_TODO_CONTENT = `# Todo

- [ ] Set up your project
- [ ] Create components
- [ ] Connect data
- [ ] Explore the playground
`;

/**
 * Ensures a `playground` directory exists in OPFS and provides a README.md.
 *
 * Returns information about whether files were created.
 */
export async function setupPlayground(options: SetupOptions = {}) {
  const folderName = options.folderName?.trim() || "playground";
  const readmeContent = options.readmeContent ?? DEFAULT_README_CONTENT;
  const todoContent = options.todoContent ?? DEFAULT_TODO_CONTENT;
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
  let createdTodo = false;

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

  // Create a starter todo.md if missing (never overwrite unless explicitly requested)
  let hasTodo = true;
  try {
    await dir.getFileHandle("todo.md");
  } catch (err: any) {
    if (err?.name === "NotFoundError" || err?.code === 404) {
      hasTodo = false;
    } else {
      throw err;
    }
  }

  if (!hasTodo) {
    const fh = await dir.getFileHandle("todo.md", { create: true });
    const writable = await fh.createWritable();

    await writable.write(todoContent);
    await writable.close();

    createdTodo = true;
  }

  return {
    folderName,
    createdReadme,
    createdTodo,
  };
}

export default setupPlayground;
