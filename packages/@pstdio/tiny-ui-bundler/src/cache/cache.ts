import { CACHE_NAME, buildVirtualUrl, getVirtualPrefix } from "../constants";
import { ensureVirtualFetchFallback } from "../runtime/fetch-fallback";

export const getBundleCacheName = () => CACHE_NAME;

export interface PublishedAsset {
  path?: string;
  source: BodyInit;
  init?: ResponseInit;
}

export interface PublishBundlePayload {
  hash: string;
  entry: PublishedAsset;
  assets: PublishedAsset[];
}

export const openBundleCache = async () => {
  if (!("caches" in globalThis)) return null;
  return caches.open(CACHE_NAME);
};

export const publishBundleToSW = async ({ hash, entry, assets }: PublishBundlePayload) => {
  const cache = await openBundleCache();
  if (!cache) return;

  console.info("[Tiny UI cache] Publishing bundle", {
    hash,
    entryBytes: typeof entry.source === "string" ? entry.source.length : null,
    assetCount: assets.length,
  });

  if (typeof entry.source === "string") {
    console.info("[Tiny UI cache] Entry preview", entry.source.slice(0, 200));
  }

  await cache.put(buildVirtualUrl(hash), new Response(entry.source, entry.init));

  for (const asset of assets) {
    const virtualUrl = buildVirtualUrl(hash, asset.path);
    await cache.put(virtualUrl, new Response(asset.source, asset.init));
  }

  ensureVirtualFetchFallback();
};

export const hasBundle = async (hash: string) => {
  const cache = await openBundleCache();
  if (!cache) return false;

  const match = await cache.match(buildVirtualUrl(hash));
  return Boolean(match);
};

export const getBundleCount = async () => {
  const cache = await openBundleCache();
  if (!cache) return 0;

  const requests = await cache.keys();
  const virtualPrefix = getVirtualPrefix();
  const bundles = requests.filter((request) => {
    try {
      const { pathname } = new URL(request.url);
      return pathname.startsWith(virtualPrefix);
    } catch {
      return false;
    }
  });
  return bundles.length;
};
