import { joinPath, ls, readFile } from "@pstdio/opfs-utils";
import { registerVirtualSnapshot, VirtualSnapshot } from "../core/snapshot";

/**
 * Load all relevant source files from an OPFS folder and register a Tiny UI snapshot.
 *
 * - folderName: OPFS path like "projects/my-plugin" (no leading slash needed).
 * - returns: VirtualSnapshot you might want to log or test against.
 *
 * Tiny UI will later resolve this snapshot using a SourceConfig whose `root`
 * exactly matches `/${folderName}`.
 */
export async function loadSnapshot(folderName: string, entry: string): Promise<VirtualSnapshot> {
  const relRoot = String(folderName || "").replace(/^\/+/, "");
  const tinyRoot = "/" + relRoot;

  const INCLUDE = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json", "**/*.css"];
  const EXCLUDE = ["**/node_modules/**", "**/.git/**", "**/.cache/**"];

  const entries = await ls(relRoot, {
    maxDepth: Infinity,
    kinds: ["file"],
    include: INCLUDE,
    exclude: EXCLUDE,
    showHidden: false,
  });

  const files: Record<string, string> = {};

  await Promise.all(
    entries.map(async (e) => {
      const absPath = joinPath(relRoot, e.path);
      const text = await readFile(absPath);
      files["/" + e.path] = text;
    }),
  );

  registerVirtualSnapshot(tinyRoot, {
    files,
    entry,
    tsconfig: null,
  });

  return {
    files,
    entry,
    tsconfig: null,
  };
}
