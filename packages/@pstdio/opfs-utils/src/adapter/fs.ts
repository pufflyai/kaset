import { configureSingle, fs } from "@zenfs/core";
import { WebAccess } from "@zenfs/dom";

let initPromise: Promise<void> | null = null;
let isConfigured = false;
let currentRoot: FileSystemDirectoryHandle | null = null;

export async function getFs(): Promise<typeof fs> {
  const storage = (typeof navigator !== "undefined" ? navigator.storage : undefined) as StorageManager | undefined;
  const getDir = storage?.getDirectory as undefined | (() => Promise<FileSystemDirectoryHandle>);

  if (typeof getDir !== "function") {
    throw new Error("OPFS is not supported (navigator.storage.getDirectory unavailable).");
  }

  const root = await getDir();

  // Fast path: already configured for this root
  if (isConfigured && currentRoot === root) {
    // If an initialization is somehow still in flight, await it
    if (initPromise) await initPromise;
    return fs;
  }

  // If another initialization is in flight (possibly from another caller), await it first
  if (initPromise) {
    await initPromise;

    // After awaiting, check again if we're now configured for this root
    if (isConfigured && currentRoot === root) {
      return fs;
    }
  }

  // Configure (or reconfigure) ZenFS for the current root
  const p = (initPromise = (async () => {
    await configureSingle({ backend: WebAccess, handle: root });
    currentRoot = root;
    isConfigured = true;
  })());

  try {
    await p;
  } catch (err) {
    // Reset so future calls can retry initialization
    initPromise = null;
    throw err;
  } finally {
    // Clear the promise after completion (success or failure handled above)
    initPromise = null;
  }

  return fs;
}
