import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compile } from "../src/esbuild/compile";
import { registerSources, removeSource } from "../src/core/sources";
import { registerVirtualSnapshot, unregisterVirtualSnapshot } from "../src/core/snapshot";
import { setLockfile } from "../src/core/idb";
import { getCachedBundle } from "../src/cache/cache-manifest";
import { CACHE_NAME } from "../src/constants";

vi.mock("esbuild-wasm", () => {
  const encoder = new TextEncoder();
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    build: vi.fn().mockResolvedValue({
      outputFiles: [
        {
          path: "out/bundle.js",
          text: 'console.log("entry")',
          contents: encoder.encode('console.log("entry")'),
        },
        {
          path: "out/assets/style-1.css",
          text: "body{}",
          contents: encoder.encode("body{}"),
        },
        {
          path: "out/chunks/chunk.js.map",
          text: "{}",
          contents: encoder.encode("{}"),
        },
      ],
      metafile: {
        outputs: {
          "out/bundle.js": { entryPoint: "/index.ts" },
          "out/assets/style-1.css": {},
          "out/chunks/chunk.js.map": {},
        },
      },
    }),
  };
});

const SOURCE_ID = "compile";
const ROOT = "/project";

const resetEnvironment = async () => {
  await caches.delete(CACHE_NAME);
  setLockfile(null);
  unregisterVirtualSnapshot(ROOT);
  removeSource(SOURCE_ID);
};

beforeEach(async () => {
  await resetEnvironment();
});

afterEach(async () => {
  await resetEnvironment();
});

describe("compile", () => {
  it("publishes outputs and reuses cached bundles", async () => {
    registerSources([{ id: SOURCE_ID, root: ROOT, entry: `${ROOT}/index.ts` }]);
    registerVirtualSnapshot(ROOT, {
      entry: `${ROOT}/index.ts`,
      files: {
        [`${ROOT}/index.ts`]: "import './styles.css'; console.log('hi');",
        [`${ROOT}/styles.css`]: "body{}",
      },
    });

    const first = await compile(SOURCE_ID, { wasmURL: "/esbuild.wasm" });
    expect(first.fromCache).toBe(false);
    expect(first.url).toMatch(/^\/virtual\/.+\.js$/);
    expect(first.assets).toContain("assets/style-1.css");

    const second = await compile(SOURCE_ID, { wasmURL: "/esbuild.wasm" });
    expect(second.fromCache).toBe(true);
    expect(second.hash).toBe(first.hash);

    const cached = await getCachedBundle(SOURCE_ID);
    expect(cached).not.toBeNull();
    expect(cached?.hash).toBe(first.hash);
  });

  it("forces a rebuild when skipCache is true", async () => {
    registerSources([{ id: SOURCE_ID, root: ROOT, entry: `${ROOT}/index.ts` }]);
    registerVirtualSnapshot(ROOT, {
      entry: `${ROOT}/index.ts`,
      files: {
        [`${ROOT}/index.ts`]: "console.log('hi');",
      },
    });

    const first = await compile(SOURCE_ID, { wasmURL: "/esbuild.wasm" });
    const second = await compile(SOURCE_ID, { wasmURL: "/esbuild.wasm", skipCache: true });

    expect(second.fromCache).toBe(false);
    expect(second.hash).toBe(first.hash);
  });
});
