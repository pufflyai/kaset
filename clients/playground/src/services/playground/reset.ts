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

  const enumeratePromise = (async () => {
    try {
      const entries = await ls(normalizedRoot, {
        maxDepth: Infinity,
        kinds: ["file", "directory"],
        showHidden: true,
        sortBy: "path",
      });

      return entries.length;
    } catch (error) {
      console.warn(`Failed to enumerate entries for reset at ${normalizedRoot}`, error);
      return 0;
    }
  })();

  const deletePromise = (async () => {
    try {
      await deleteDirectoryContents(normalizedRoot);
    } catch (error) {
      console.warn(`Failed to delete contents during reset at ${normalizedRoot}`, error);
    }
  })();

  const cacheClearPromise = (async () => {
    try {
      if ("caches" in globalThis) {
        await caches.delete(CACHE_NAME);
      }
    } catch (error) {
      console.warn("Failed to clear Tiny UI caches during reset", error);
    }
  })();

  const [deleted] = await Promise.all([enumeratePromise, deletePromise, cacheClearPromise]);

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
