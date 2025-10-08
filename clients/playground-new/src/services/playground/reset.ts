import { ROOT } from "@/constant";
import { deleteFile, ls } from "@pstdio/opfs-utils";

import { setupPlayground } from "./setup";

export type ResetOptions = {
  rootDir?: string;
};

export async function resetPlayground(options: ResetOptions = {}) {
  const rootDir = options.rootDir?.trim() || ROOT;
  const normalizedRoot = rootDir.replace(/\\/g, "/").replace(/^\/+/, "");

  let deleted = 0;

  try {
    const files = await ls(normalizedRoot, {
      maxDepth: Infinity,
      kinds: ["file"],
      showHidden: true,
      sortBy: "path",
    });

    for (const entry of files) {
      try {
        await deleteFile(`${normalizedRoot}/${entry.path}`);
        deleted++;
      } catch (error) {
        console.warn(`Failed to delete ${entry.path} during reset`, error);
      }
    }
  } catch (error) {
    console.warn(`Failed to enumerate files for reset at ${normalizedRoot}`, error);
  }

  const setupResult = await setupPlayground({ rootDir: normalizedRoot, overwrite: true });

  return {
    rootDir: normalizedRoot,
    deleted,
    written: setupResult.written,
    rootFiles: setupResult.rootFiles,
    pluginFiles: setupResult.pluginFiles,
  };
}
