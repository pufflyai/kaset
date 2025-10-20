import { ROOT } from "@/constant";
import { deleteDirectoryContents, ls } from "@pstdio/opfs-utils";
import { CACHE_NAME } from "@pstdio/tiny-ui";

import { setupPlayground } from "./setup";

export type ResetOptions = {
  rootDir?: string;
};

const TINY_UI_CACHE_PREFIX = "tiny-ui-";

async function clearTinyUiCaches() {
  if (!("caches" in globalThis)) return 0;

  try {
    const keys = await caches.keys();
    let cleared = 0;

    for (const key of keys) {
      if (key === CACHE_NAME || key.startsWith(TINY_UI_CACHE_PREFIX)) {
        const deleted = await caches.delete(key);
        if (deleted) {
          cleared += 1;
        }
      }
    }

    return cleared;
  } catch (error) {
    console.warn("[resetPlayground] Failed to clear Tiny UI caches", error);
    return 0;
  }
}

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

  const cacheCleared = await clearTinyUiCaches();

  const setupResult = await setupPlayground({ rootDir: normalizedRoot, overwrite: true });

  return {
    rootDir: normalizedRoot,
    deleted,
    written: setupResult.written,
    rootFiles: setupResult.rootFiles,
    pluginFiles: setupResult.pluginFiles,
    pluginDataFiles: setupResult.pluginDataFiles,
    cachesCleared: cacheCleared,
  };
}
