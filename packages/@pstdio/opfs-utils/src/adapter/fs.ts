import { configureSingle, fs } from "@zenfs/core";
import { WebAccess } from "@zenfs/dom";

let initPromise: Promise<void> | null = null;
let configuredRoot: FileSystemDirectoryHandle | null = null;

/**
 * Safely get OPFS root getter or null if unsupported.
 */
function getOPFSRootGetter(): (() => Promise<FileSystemDirectoryHandle>) | null {
  if (typeof navigator === "undefined" || !navigator.storage) return null;

  const getDirectory = (
    navigator.storage as StorageManager & {
      getDirectory?: () => Promise<FileSystemDirectoryHandle>;
    }
  ).getDirectory;

  return typeof getDirectory === "function" ? getDirectory.bind(navigator.storage) : null;
}

/**
 * Compare directory handles robustly. Prefer FileSystemHandle.isSameEntry if present.
 * Falls back to reference equality when needed.
 */
async function sameRoot(a: FileSystemDirectoryHandle | null, b: FileSystemDirectoryHandle): Promise<boolean> {
  if (!a) return false;

  const anyA = a as unknown as { isSameEntry?: (o: FileSystemDirectoryHandle) => Promise<boolean> };
  if (typeof anyA.isSameEntry === "function") {
    try {
      return await anyA.isSameEntry(b);
    } catch {
      // Some environments can throw; fall through to reference equality.
    }
  }
  return a === b;
}

/**
 * Ensures ZenFS is configured for the provided root, handling concurrent callers.
 */
async function ensureConfiguredFor(root: FileSystemDirectoryHandle): Promise<void> {
  // Already configured for this root? Ensure any in-flight init has settled.
  if (await sameRoot(configuredRoot, root)) {
    if (initPromise) await initPromise;
    return;
  }

  // Another init may be in flight; await it and re-check before proceeding.
  if (initPromise) {
    await initPromise;
    if (await sameRoot(configuredRoot, root)) return;
  }

  initPromise = (async () => {
    try {
      await configureSingle({ backend: WebAccess, handle: root });
      configuredRoot = root;
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

export async function getFs(): Promise<typeof fs> {
  const getDir = getOPFSRootGetter();

  if (!getDir) {
    throw new Error("OPFS is not supported (navigator.storage.getDirectory unavailable).");
  }

  const root = await getDir();
  await ensureConfiguredFor(root);

  return fs;
}
