import { beforeEach, describe, expect, it } from "vitest";
import { publishBundleToSW } from "./cache";
import { clearCachedCompileResult, getCachedBundle, setCachedCompileResult } from "./cache-manifest";
import { computeLockfileHash } from "../core/hash";
import { setLockfile } from "../core/idb";
import { CACHE_NAME, getManifestUrl } from "../constants";

const SOURCE_ID = "source";

const reset = async () => {
  await caches.delete(CACHE_NAME);
  setLockfile(null);
};

describe("cache-manifest", () => {
  beforeEach(async () => {
    await reset();
  });

  it("returns null when assets are missing", async () => {
    const lockfile = { react: "https://esm.sh/react" };
    setLockfile(lockfile);
    const lockfileHash = await computeLockfileHash(lockfile);

    const hash = "hash";
    await publishBundleToSW({
      hash,
      entry: {
        source: "console.log('hi')",
        init: { headers: { "Content-Type": "application/javascript" } },
      },
      assets: [{ path: "assets/style.css", source: "body{}", init: { headers: { "Content-Type": "text/css" } } }],
    });

    await setCachedCompileResult(SOURCE_ID, {
      id: SOURCE_ID,
      hash,
      url: `/virtual/${hash}.js`,
      fromCache: false,
      bytes: 42,
      assets: ["assets/style.css"],
      lockfileHash,
    });

    const hit = await getCachedBundle(SOURCE_ID);
    expect(hit).not.toBeNull();

    const cache = await caches.open(CACHE_NAME);
    await cache.delete(`/virtual/${hash}/assets/style.css`);

    const miss = await getCachedBundle(SOURCE_ID);
    expect(miss).toBeNull();

    const manifestResponse = await cache.match(getManifestUrl());
    const manifest = manifestResponse ? await manifestResponse.json() : {};
    expect(manifest[SOURCE_ID]).toBeUndefined();

    await clearCachedCompileResult(SOURCE_ID);
  });

  it("invalidates cache when lockfile hash differs", async () => {
    const hash = "hash";
    setLockfile({ dep: "1.0.0" });
    const lockfileHash = await computeLockfileHash({ dep: "1.0.0" });

    await publishBundleToSW({
      hash,
      entry: {
        source: "console.log('hi')",
        init: { headers: { "Content-Type": "application/javascript" } },
      },
      assets: [],
    });

    await setCachedCompileResult(SOURCE_ID, {
      id: SOURCE_ID,
      hash,
      url: `/virtual/${hash}.js`,
      fromCache: false,
      bytes: 12,
      assets: [],
      lockfileHash,
    });

    setLockfile({ dep: "2.0.0" });
    const result = await getCachedBundle(SOURCE_ID);
    expect(result).toBeNull();
  });
});
