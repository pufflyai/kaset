import { beforeEach, describe, expect, it } from "vitest";
import { getBundleCount, hasBundle, publishBundleToSW } from "./cache";
import { CACHE_NAME, buildVirtualUrl } from "../constants";

const clearCache = async () => {
  await caches.delete(CACHE_NAME);
};

describe("cache", () => {
  beforeEach(async () => {
    await clearCache();
  });

  it("publishes bundles and tracks entries", async () => {
    await publishBundleToSW({
      hash: "hash",
      entry: {
        source: "console.log('hi')",
        init: { headers: { "Content-Type": "application/javascript" } },
      },
      assets: [{ path: "assets/style.css", source: "body{}", init: { headers: { "Content-Type": "text/css" } } }],
    });

    expect(await hasBundle("hash")).toBe(true);

    const cache = await caches.open(CACHE_NAME);
    const entry = await cache.match(buildVirtualUrl("hash"));
    expect(entry).toBeDefined();

    expect(await getBundleCount()).toBeGreaterThan(0);
  });
});
