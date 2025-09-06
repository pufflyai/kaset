import { applyFilesToOpfs } from "@/services/playground/setup";

export type SetupOptions = {
  /** OPFS root folder name. Defaults to "playground". */
  folderName?: string;
  /** Overwrite existing files. Defaults to true. */
  overwrite?: boolean;
};

/**
 * Setup the Todo example by copying bundled files into OPFS under `folderName`.
 * Files are sourced from `src/examples/todo/files/**` at build time.
 */
export async function setupPlayground(options: SetupOptions = {}) {
  const folderName = options.folderName?.trim() || "playground";
  const overwrite = options.overwrite ?? true;

  // Eagerly bundle all text files under the example's files directory
  const rawFiles = import.meta.glob("/src/examples/todo/files/**", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >;

  // Rewrite special filenames for OPFS targets:
  // - __agents.md  -> agents.md (placed at folder root)
  // - readme.md    -> readme.md (already at folder root)
  const files: Record<string, string> = {};
  for (const [absKey, content] of Object.entries(rawFiles)) {
    const key = absKey.endsWith("/__agents.md") ? absKey.replace(/\/__agents\.md$/, "/agents.md") : absKey;
    files[key] = content;
  }

  return applyFilesToOpfs({ rootDir: folderName, files, baseDir: "/src/examples/todo/files", overwrite });
}

export default setupPlayground;
