import { ROOT } from "@/constant";
import { deleteDirectoryContents, ls } from "@pstdio/opfs-utils";
import { CACHE_NAME } from "@pstdio/tiny-ui";

import { setupPlayground } from "./setup";

export type ResetOptions = {
  rootDir?: string;
};

export async function resetPlayground(options: ResetOptions = {}) {
  const rootDir = options.rootDir?.trim() || ROOT;
  const normalizedRoot = rootDir.replace(/\\/g, "/").replace(/^\/+/, "");

  let deleted = 0;

  try {
    const entries = await ls(normalizedRoot, {
      maxDepth: Infinity,
      kinds: ["file", "directory"],
      showHidden: true,
      sortBy: "path",
    });

    deleted = entries.length;
  } catch (error) {
    console.warn(`Failed to enumerate entries for reset at ${normalizedRoot}`, error);
  }

  try {
    await deleteDirectoryContents(normalizedRoot);
  } catch (error) {
    console.warn(`Failed to delete contents during reset at ${normalizedRoot}`, error);
  }

  try {
    if ("caches" in globalThis) {
      await caches.delete(CACHE_NAME);
    }
  } catch (error) {
    console.warn("Failed to clear Tiny UI caches during reset", error);
  }

  const setupResult = await setupPlayground({ rootDir: normalizedRoot, overwrite: true });

  return {
    rootDir: normalizedRoot,
    deleted,
    written: setupResult.written,
    rootFiles: setupResult.rootFiles,
    pluginFiles: setupResult.pluginFiles,
    pluginDataFiles: setupResult.pluginDataFiles,
  };
}
