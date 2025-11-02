---
title: "@pstdio/tiny-ui-bundler"
---

# @pstdio/tiny-ui-bundler

**Service worker bundler and runtime asset manager for Tiny UI.**

Compile plugin source trees with `esbuild-wasm`, publish bundles into the Cache API, and serve the runtime service worker and import maps needed by `@pstdio/tiny-ui`.

## Install

```bash
npm i @pstdio/tiny-ui-bundler
```

## Why Tiny UI Bundler?

- Register OPFS-backed source trees and compile them entirely in the browser—no server build step required.
- Manage Tiny UI's service worker lifecycle, ensuring runtime assets stay in sync with the latest bundle hash.
- Generate and persist lockfiles/import maps so bare module specifiers resolve reliably across plugin reloads.
- Ship companion helpers for OPFS persistence and virtual snapshot loading that the Tiny UI runtime consumes.

## Quick Start

### 1. Register sources and lockfile

Provide the Tiny UI bundler with source roots and an import-map lockfile. These values are read by the compile step and cached for subsequent rebuilds.

```ts
import { registerSources, setLockfile } from "@pstdio/tiny-ui-bundler";

setLockfile({
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
});

registerSources([{ id: "weather-ui", root: "/plugins/weather-ui", entry: "/index.tsx" }]);
```

### 2. Compile and deploy the bundle

Call `compile` to run `esbuild-wasm` in the browser and cache the results. The compile result includes a service worker hash that keeps runtime assets synchronized.

```ts
import { compile } from "@pstdio/tiny-ui-bundler";

const result = await compile("weather-ui", {
  wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
});

console.log(result.url, result.hash, result.assets);
```

### 3. Prepare runtime assets

When hosting Tiny UI in production, call `prepareRuntimeAssets` during your build or deploy flow to ensure the runtime HTML and service worker files are available at stable URLs.

```ts
import { prepareRuntimeAssets } from "@pstdio/tiny-ui-bundler";

await prepareRuntimeAssets({
  runtimePath: "public/tiny-ui/runtime.html",
  serviceWorkerPath: "public/tiny-ui-sw.js",
});
```

The Tiny UI runtime can then import `runtime.html` and `sw.js` directly, or you can provide their paths explicitly via `setupTinyUI`.
