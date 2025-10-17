import { joinPath, ls, readFile } from "@pstdio/opfs-utils";
import { registerVirtualSnapshot, type VirtualSnapshot } from "@pstdio/tiny-ui-bundler";

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

  const INCLUDE = [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "**/*.mjs",
    "**/*.cjs",
    "**/*.json",
    "**/*.css",
    "**/*.scss",
    "**/*.sass",
    "**/*.md",
  ];
  const EXCLUDE = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.cache/**",
    "**/dist/**",
    "**/build/**",
    "**/.turbo/**",
    "**/.nx/**",
    "**/out/**",
  ];

  const entries = await ls(relRoot, {
    maxDepth: Infinity,
    kinds: ["file"],
    include: INCLUDE,
    exclude: EXCLUDE,
    showHidden: false,
  });

  const tsconfigCandidates = ["tsconfig.ui.json", "tsconfig.app.json", "tsconfig.json"];
  const tsconfigSet = new Set(tsconfigCandidates);
  const files: Record<string, string> = {};
  let tsconfig: string | null = null;

  for (const candidate of tsconfigCandidates) {
    try {
      tsconfig = await readFile(joinPath(relRoot, candidate));
      break;
    } catch {
      // ignore missing tsconfig variants
    }
  }

  await Promise.all(
    entries.map(async (entryInfo) => {
      if (tsconfigSet.has(entryInfo.path)) return;

      const absPath = joinPath(relRoot, entryInfo.path);
      const text = await readFile(absPath);
      files["/" + entryInfo.path] = text;
    }),
  );

  const entryRelative = entry.replace(/^\/+/, "");
  if (!files["/" + entryRelative]) {
    const entryText = await readFile(joinPath(relRoot, entryRelative));
    files["/" + entryRelative] = entryText;
  }

  const snapshot: VirtualSnapshot = {
    files,
    entry,
    tsconfig,
  };

  registerVirtualSnapshot(tinyRoot, snapshot);

  return snapshot;
}
