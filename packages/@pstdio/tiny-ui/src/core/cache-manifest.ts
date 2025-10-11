import type { CompileResult } from "../esbuild/types";
import { getManifestUrl, getVirtualPrefix } from "../constant";
import { openBundleCache } from "./cache";
import { computeLockfileHash } from "./hash";
import { getLockfile } from "./idb";
const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

interface ManifestEntry {
  hash: string;
  url: string;
  assets: string[];
  bytes: number;
  lockfileHash: string;
  fromCache: boolean;
  updatedAt: number;
}

type Manifest = Record<string, ManifestEntry>;

const toAssetUrl = (hash: string, asset: string) => {
  const normalized = asset.startsWith("/") ? asset.slice(1) : asset;
  return `${getVirtualPrefix()}${hash}/${normalized}`;
};

const readManifest = async (cache: Cache): Promise<Manifest> => {
  const response = await cache.match(getManifestUrl());
  if (!response) return {};

  try {
    const data = await response.json();
    if (typeof data !== "object" || data === null) return {};
    return data as Manifest;
  } catch (error) {
    console.warn("[Tiny UI cache] Failed to parse manifest", error);
    return {};
  }
};

const persistManifest = async (cache: Cache, manifest: Manifest) => {
  if (Object.keys(manifest).length === 0) {
    await cache.delete(getManifestUrl());
    return;
  }

  const payload = JSON.stringify(manifest);
  await cache.put(getManifestUrl(), new Response(payload, { headers: JSON_HEADERS }));
};

const deleteCacheEntries = async (cache: Cache, entry: ManifestEntry) => {
  await cache.delete(entry.url);

  for (const asset of entry.assets) {
    await cache.delete(toAssetUrl(entry.hash, asset));
  }
};

let manifestLock: Promise<void> = Promise.resolve();

const withManifestLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = manifestLock.then(fn);
  manifestLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const loadManifestContext = async () => {
  const cache = await openBundleCache();
  if (!cache) return null;
  const manifest = await readManifest(cache);
  return { cache, manifest };
};

export const setCachedCompileResult = async (id: string, result: CompileResult & { lockfileHash: string }) => {
  await withManifestLock(async () => {
    const context = await loadManifestContext();
    if (!context) return;

    const { cache, manifest } = context;
    manifest[id] = {
      hash: result.hash,
      url: result.url,
      assets: [...result.assets],
      bytes: result.bytes,
      lockfileHash: result.lockfileHash,
      fromCache: result.fromCache,
      updatedAt: Date.now(),
    };

    await persistManifest(cache, manifest);
  });
};

export const clearCachedCompileResult = async (id: string) => {
  await withManifestLock(async () => {
    const context = await loadManifestContext();
    if (!context) return;

    const { cache, manifest } = context;
    const entry = manifest[id];
    if (!entry) return;

    delete manifest[id];
    await deleteCacheEntries(cache, entry);
    await persistManifest(cache, manifest);
  });
};

const removeEntry = async (id: string) => {
  await withManifestLock(async () => {
    const context = await loadManifestContext();
    if (!context) return;

    const { cache, manifest } = context;
    const entry = manifest[id];
    if (!entry) return;

    delete manifest[id];
    await persistManifest(cache, manifest);
  });
};

export const getCachedBundle = async (id: string): Promise<CompileResult | null> => {
  const context = await loadManifestContext();
  if (!context) return null;

  const { cache, manifest } = context;
  const entry = manifest[id];
  if (!entry) return null;

  const virtualPrefix = getVirtualPrefix();
  if (!entry.url.startsWith(virtualPrefix)) {
    await removeEntry(id);
    return null;
  }

  const lockfileHash = await computeLockfileHash(getLockfile() ?? null);
  if (entry.lockfileHash !== lockfileHash) return null;

  const bundle = await cache.match(entry.url);
  if (!bundle) {
    await removeEntry(id);
    return null;
  }

  for (const asset of entry.assets) {
    const assetUrl = toAssetUrl(entry.hash, asset);
    const assetResponse = await cache.match(assetUrl);
    if (!assetResponse) {
      await removeEntry(id);
      return null;
    }
  }

  const result: CompileResult = {
    id,
    hash: entry.hash,
    url: entry.url,
    fromCache: true,
    bytes: entry.bytes,
    assets: [...entry.assets],
    lockfileHash,
  };

  return result;
};
