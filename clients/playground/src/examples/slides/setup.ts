import { applyFilesToOpfs } from "@/services/playground/setup";

export type SetupOptions = {
  /** OPFS root folder name. Defaults to "playground/slides". */
  folderName?: string;
  /** Overwrite existing files. Defaults to true. */
  overwrite?: boolean;
};

/**
 * Setup the Slides example by copying bundled files into OPFS under `folderName`.
 * Files are sourced from `src/examples/slides/**` at build time.
 */
export async function setupSlides(options: SetupOptions = {}) {
  const folderName = options.folderName?.trim() || "playground/slides";
  const overwrite = options.overwrite ?? true;

  // Eagerly bundle all text files under the example's directory
  const rawFiles = import.meta.glob("/src/examples/slides/**", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >;

  return applyFilesToOpfs({ rootDir: folderName, files: rawFiles, baseDir: "/src/examples/slides", overwrite });
}

export default setupSlides;

