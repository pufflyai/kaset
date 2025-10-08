# Tiny UI

[![npm version](https://img.shields.io/npm/v/@pstdio/tiny-ui.svg?color=blue)](https://www.npmjs.com/package/@pstdio/tiny-ui)
[![license](https://img.shields.io/npm/l/@pstdio/tiny-ui)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Ftiny-ui)](https://bundlephobia.com/package/%40pstdio%2Ftiny-ui)

> **Browser-first plugin runtime for sandboxed micro frontends.**
> Compile OPFS-backed sources with `esbuild-wasm`, cache bundles in a service worker, and expose audited host capabilities to plugin iframes.

## ✨ Why?

- Build and ship third-party plugin UIs entirely in the browser—no server build step required.
- Publish compiled bundles to the Cache API and serve them through a dedicated service worker + runtime iframe.
- Hand plugins a typed `host` bridge for filesystem, workspace reads, settings, and notifications through a single RPC surface.
- Reuse the Tiny Plugins lockfile/import-map tooling so bare specifiers resolve deterministically.

## 🏁 Quick start

### Installation

```sh
npm i @pstdio/tiny-ui
```

### 1. Serve the runtime assets

Expose the runtime HTML and service worker from your app origin. With Vite (or any bundler that supports the `?url` suffix), you can import the asset URLs directly:

```ts
// host/bootstrap.ts
import runtimeUrl from "@pstdio/tiny-ui/dist/runtime.html?url";
import serviceWorkerUrl from "@pstdio/tiny-ui/dist/sw.js?url";

navigator.serviceWorker.register(serviceWorkerUrl).catch(console.error);
```

If your bundler cannot import assets as URLs, copy `dist/runtime.html` and `dist/sw.js` to `/tiny-ui/runtime.html` and `/tiny-ui-sw.js` in your public folder.

### 2. Register a virtual project snapshot

Load the plugin source tree (for example, from OPFS) and cache it with Tiny UI. The compile step reads this snapshot when it builds the bundle.

```ts
import { loadSnapshot, setLockfile } from "@pstdio/tiny-ui";

setLockfile({
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
});

const source = {
  id: "weather-ui",
  root: "/plugins/weather-ui",
  entrypoint: "/index.tsx",
};

await loadSourceFiles(source);

const result = await compile(source.id, {
  wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
});

console.log(result.hash, result.url, result.assets);
```

> `setLockfile` is global for the current page. Every Tiny UI instance shares the same dependency map, so merge all required bare specifiers into one object before calling it. Extra entries only increase the import map JSON size—browsers download the actual modules only when a bundle imports them.

`loadSourceFiles` is a convenience helper that registers the source metadata and walks the OPFS folder to register a virtual snapshot. If you already manage snapshots yourself, you can still call `registerSources` and `registerVirtualSnapshot` directly.

### 4. Boot a raw iframe

You can host Tiny UI manually by wiring an iframe straight to the Tiny UI runtime.

```html
<button id="load-plugin">Load plugin</button>
<iframe id="tiny-ui-iframe" title="tiny-ui" style="width: 100%; height: 420px; border: 1px solid #ccc;"></iframe>

<script type="module">
  import { compile, createIframeOps, createTinyHost, loadSourceFiles, setLockfile } from "@pstdio/tiny-ui";

  const iframe = document.getElementById("tiny-ui-iframe");
  const button = document.getElementById("load-plugin");

  const source = {
    id: "weather-ui",
    root: "/plugins/weather-ui",
    entrypoint: "/index.tsx",
  };

  setLockfile({
    react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
    "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
  });

  button.addEventListener("click", async () => {
    const host = await createTinyHost(iframe, source.id);

    host.onOps(createIframeOps({ pluginsRoot: "/plugins", pluginId: source.id }));
    host.onReady(({ meta }) => console.log("Plugin ready", meta));
    host.onError(({ message }) => console.error("Plugin failed", message));

    await loadSourceFiles(source);

    const compileResult = await compile(source.id, {
      wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
    });

    await host.sendInit(compileResult);
  });
</script>
```

### 5. Render the React wrapper

```tsx
import { TinyUI } from "@pstdio/tiny-ui";

function PluginFrame() {
  return (
    <TinyUI
      id="weather-ui"
      root="/plugins/weather-ui"
      serviceWorkerUrl={serviceWorkerUrl}
      runtimeUrl={runtimeUrl}
      onReady={(result) => console.log("Bundle ready", result)}
      onError={(error) => console.error(error)}
    />
  );
}
```

- `id` is the stable bundle identifier Tiny UI uses when publishing and caching bundles—keep it unique per plugin.
- `root` is the same root path used in `loadSnapshot`.
- Tiny UI auto-compiles when the service worker is ready. Call the imperative `rebuild()` handle to recompile on demand.

### 6. Bridge host capabilities (optional but recommended)

Pass `bridge` to `<TinyUI />` to allow plugins to talk to the host via `remote.ops`.

```tsx
import { createIframeOps, createWorkspaceFs } from "@pstdio/tiny-ui";

const bridge = {
  pluginsRoot: "/plugins",
  pluginId: "weather-ui",
  notify: (level, message) => console.info(`[${level}] ${message}`),
  workspaceFs: createWorkspaceFs("/workspace"),
};

<TinyUI
  id="weather-ui"
  root="/plugins/weather-ui"
  serviceWorkerUrl={serviceWorkerUrl}
  runtimeUrl={runtimeUrl}
  bridge={bridge}
/>;
```

Inside the iframe runtime, plugins receive a `host` object with:

- `host.fs.readFile/writeFile/ls/deleteFile/downloadFile`
- `host.workspace.read/readFile`
- `host.settings.read/write`

### Manual host integration with precompiled bundle

```ts
import { createIframeOps, createTinyHost } from "@pstdio/tiny-ui";

const iframe = document.querySelector("iframe#plugin")!;
const host = await createTinyHost(iframe, "sql-explorer");

host.onOps(createIframeOps({ pluginsRoot: "/plugins", pluginId: "sql-explorer" }));

host.onReady(({ meta }) => console.log("Plugin ready", meta));
host.onError(({ message }) => console.error("Plugin failed", message));

const compileResult = await fetch("/precompiled/sql-explorer.json").then((res) => res.json());

await host.sendInit(compileResult);
```

- `host.commands.notify`

All filesystem mutations are scoped to `/plugins/<pluginId>/data`, and workspace reads remain read-only.

### Instant iframe boot from the cache manifest

If you previously compiled a plugin and the service worker still holds the bundle, you can skip `compile` entirely and boot straight from the cache manifest.

```ts
import { compile, createIframeOps, createTinyHost, getCachedBundle } from "@pstdio/tiny-ui";

const pluginId = "sql-explorer";
const iframe = document.querySelector("iframe#plugin")!;
const host = await createTinyHost(iframe, pluginId);

host.onOps(createIframeOps({ pluginsRoot: "/plugins", pluginId }));

let result = await getCachedBundle(pluginId);

if (!result) {
  const source = {
    id: pluginId,
    root: "/plugins/weather-ui",
    entrypoint: "/index.tsx",
  };

  await loadSourceFiles(source);

  result = await compile(pluginId, {
    wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
  });
}

await host.sendInit(result);
```

- `getCachedBundle` validates both the manifest entry and each cached asset before returning a result; it returns `null` if anything became stale (missing assets or lockfile mismatch).
- The `compile` fallback automatically refreshes the manifest and Cache API entries, so subsequent reloads can start instantly.

## 📚 Examples

### Load OPFS files once, reuse across reloads

```ts
import { loadSnapshot, TinyUI, CACHE_NAME } from "@pstdio/tiny-ui";

async function bootPlugin() {
  await loadSnapshot("plugins/notepad", "/index.tsx");
  render(<TinyUI id="notepad" root="/plugins/notepad" serviceWorkerUrl="/tiny-ui-sw.js" />);
}

async function invalidateBundles() {
  if (typeof caches === "undefined") return;
  await caches.delete(CACHE_NAME);
}
```

## 📖 API

- `TinyUI(props)` – React component that compiles snapshots and boots the runtime iframe. Accepts `bridge`, lifecycle callbacks, and `autoCompile`.
- `TinyUIHandle` – ref object exposing `rebuild()`.
- `TinyUIStatus` – status union (`"initializing" | "idle" | "compiling" | "ready" | "error"`).
- `registerVirtualSnapshot(root, snapshot)` / `unregisterVirtualSnapshot(root)` – cache the in-memory file tree Tiny UI will compile.
- `loadSnapshot(folder, entry)` – convenience helper that reads OPFS into a snapshot and registers it.
- `setLockfile(lockfile)` / `getLockfile()` / `resetStats()` / `getStats()` – manage remote module metadata and runtime counters.
- `buildImportMap(lockfile)` – convert a lockfile into an import map for the runtime iframe.
- `createTinyHost(iframe, id)` – low-level host connector exposing `sendInit`, `onReady`, `onError`, `onOps`, and `disconnect`.
- `createIframeOps(options)` – build a typed `remote.ops` handler that wires scoped plugin storage, workspace reads, settings, and notifications.
- `createWorkspaceFs(root)` – wrap OPFS access for workspace reads.
- `CACHE_NAME`, `RUNTIME_HTML_PATH`, `VIRTUAL_PREFIX` – constants that mirror the service worker config.
