import { CACHE_NAME } from "../constant";

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

const buildVirtualUrl = (hash: string, assetPath?: string) => {
  if (!assetPath) return `/virtual/${hash}.js`;
  const normalized = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  return `/virtual/${hash}/${normalized}`;
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
  const bundles = requests.filter((request) => request.url.includes("/virtual/"));
  return bundles.length;
};
