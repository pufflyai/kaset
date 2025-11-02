# Tiny UI Bundler

[![npm version](https://img.shields.io/npm/v/@pstdio/tiny-ui-bundler.svg?color=blue)](https://www.npmjs.com/package/@pstdio/tiny-ui-bundler)
[![license](https://img.shields.io/npm/l/@pstdio/tiny-ui-bundler)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Ftiny-ui-bundler)](https://bundlephobia.com/package/%40pstdio%2Ftiny-ui-bundler)

> **In-browser bundler + cache manifest for Tiny UI plugins.**
> Compile OPFS snapshots with esbuild-wasm, manage remote deps, and hydrate iframes from a service worker cache.

For additional information, please refer to the [documentation](https://pufflyai.github.io/kaset/packages/tiny-ui-bundler).

## ✨ Why?

- Build Tiny UI bundles entirely in the browser from in-memory sources — no backend build step.
- Derive stable bundle hashes from file digests plus the lockfile so cache hits stay deterministic.
- Publish entry chunks and assets into the Cache API and store a manifest for instant `getCachedBundle` lookups.
- Keep remote dependencies deterministic with a lockfile-powered resolver while surfacing compile metrics for telemetry.

## 🏁 Quick start

### Installation

```sh
npm i @pstdio/tiny-ui-bundler
```

### 1. Register sources and snapshots

```ts
import { registerSources, registerVirtualSnapshot, setLockfile } from "@pstdio/tiny-ui-bundler";

const sourceId = "weather-ui";
const root = "/plugins/weather-ui";

setLockfile({
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
});

registerSources([{ id: sourceId, root, entry: `${root}/index.tsx` }]);

registerVirtualSnapshot(root, {
  entry: "/index.tsx",
  files: {
    "/index.tsx": `import App from "./App"; App();`,
    "/App.tsx": `export default function App() { console.info("Weather"); }`,
  },
});
```

### 2. Compile and reuse cached bundles

```ts
import { compile, getCachedBundle } from "@pstdio/tiny-ui-bundler";
import esbuildWasmUrl from "esbuild-wasm/esbuild.wasm?url";

const result = await compile(sourceId, { wasmURL: esbuildWasmUrl });

console.log(result.url, result.fromCache); // e.g. "virtual/<hash>.js", false

const cached = await getCachedBundle(sourceId);
if (cached) {
  console.log(cached.fromCache); // true when manifest + Cache API match
}
```

### 3. Serve bundles through a Tiny UI service worker

```ts
import { setBasePath, resolveBasePath } from "@pstdio/tiny-ui-bundler";

await navigator.serviceWorker.register("/tiny-ui-sw.js");
setBasePath("/");

const runtimeUrl = resolveBasePath("tiny-ui/runtime.html");
// <iframe src={runtimeUrl} ...> will now fetch from the Cache API
```

### 4. Hand the iframe an import map

```ts
import { buildImportMap } from "@pstdio/tiny-ui-bundler";

const lockfile = {
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
};

const importMap = buildImportMap(lockfile);
// send to the iframe before booting the bundle
```

## 📚 Examples

### Scope bundles to a nested base path

```ts
import { setBasePath, resolveBasePath } from "@pstdio/tiny-ui-bundler";

setBasePath("/playground/");
const bundleUrl = resolveBasePath("virtual/a1b2c3.js");
```

### Report compile stats

```ts
import { getStats } from "@pstdio/tiny-ui-bundler";

const stats = getStats();
// { compiles: { total, cacheHits, avgMs }, iframes, cache: { bundles } }
```

## 📖 API

- **compile** `compile(id, { wasmURL, define?, skipCache? })` builds the registered snapshot, publishes it to the Cache API, and returns a `CompileResult`.
- **snapshots** `registerSources(configs)`, `updateSource(config)`, `removeSource(id)`, `listSources()`, `getSource(id)`, `registerVirtualSnapshot(root, snapshot)`, `unregisterVirtualSnapshot(root)`, `readSnapshot(config)`.
- **cache manifest** `getCachedBundle(id)`, `setCachedCompileResult(id, result)`, `clearCachedCompileResult(id)` keep the SW manifest and Cache API in sync.
- **lockfile** `setLockfile(lockfile)`, `getLockfile()`, `buildImportMap(lockfile)` wire remote module URLs into esbuild and the iframe.
- **base path** `setBasePath(path)`, `resolveBasePath(path)`, `getBasePath()`, `resetBasePath()` align virtual URLs with the active service-worker scope.
- **metrics & types** `getStats()`, `resetStats()`, plus `VirtualSnapshot`, `ProjectSnapshot`, `SourceConfig`, `CompileResult`, `BuildWithEsbuildOptions`, `Lockfile`, `ImportMap`.

## ℹ️ Usage notes

- Ensure `navigator.serviceWorker` and the Cache API are available; the bundler expects to run in modern browsers.
- Refresh snapshots by calling `registerVirtualSnapshot` again after OPFS updates so digest hashes invalidate correctly.
- Provide a reachable `wasmURL` for `esbuild-wasm`; the default unpkg URL works for quick demos.
- Call `setBasePath` when serving Tiny UI assets from a non-root path so manifest URLs resolve to the right scope.

## ⚠️ Caveats

- Lockfiles and stats live in-memory; reinitialize them on every page load if you need persistence.
- A cache hit still checks the manifest and asset presence—deleted Cache API entries rebuild on the next `compile`.
- `clearCachedCompileResult` removes the manifest entry but leaves other scopes untouched; delete the Cache API manually when you need a full reset.
- Service worker registration failures prevent the iframe from loading `virtual/*` URLs; surface the error to users before invoking `compile`.
