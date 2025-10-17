# Tiny UI

[![npm version](https://img.shields.io/npm/v/@pstdio/tiny-ui.svg?color=blue)](https://www.npmjs.com/package/@pstdio/tiny-ui)
[![license](https://img.shields.io/npm/l/@pstdio/tiny-ui)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Ftiny-ui)](https://bundlephobia.com/package/%40pstdio%2Ftiny-ui)

> **Browser-first plugin runtime for sandboxed micro frontends.**
> Compile OPFS-backed sources with `esbuild-wasm`, cache bundles in a service worker, and expose audited host capabilities to plugin iframes.

## ✨ Why?

- Build and ship third-party plugin UIs entirely in the browser—no server build step required.
- Publish compiled bundles to the Cache API and serve them through a dedicated service worker + runtime iframe.
- Hand plugins a typed `host` bridge via a single `onActionCall` RPC surface.
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
import serviceWorkerUrl from "@pstdio/tiny-ui-bundler/dist/sw.js?url";
import { setupTinyUI } from "@pstdio/tiny-ui";

void setupTinyUI({ runtimeUrl, serviceWorkerUrl }).catch(console.error);
```

If your bundler cannot import assets as URLs, copy `@pstdio/tiny-ui/dist/runtime.html` and `@pstdio/tiny-ui-bundler/dist/sw.js` to `/tiny-ui/runtime.html` and `/tiny-ui-sw.js`, then call `setupTinyUI({ runtimeUrl: "/tiny-ui/runtime.html", serviceWorkerUrl: "/tiny-ui-sw.js" })` during your app bootstrap.

### 2. Register a virtual project snapshot

Load the plugin source tree (for example, from OPFS) and cache it with Tiny UI. The compile step reads this snapshot when it builds the bundle.

```ts
import { loadSnapshot, setLockfile } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";

setLockfile({
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
});

const source = {
  id: "weather-ui",
  root: "/plugins/weather-ui",
  entrypoint: "/index.tsx",
};

await loadSnapshot(source.root, source.entrypoint);
registerSources([{ id: source.id, root: source.root, entry: source.entrypoint }]);

const result = await compile(source.id, {
  wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
});

console.log(result.hash, result.url, result.assets);
```

> `setLockfile` is global for the current page. Every Tiny UI instance shares the same dependency map, so merge all required bare specifiers into one object before calling it. Extra entries only increase the import map JSON size—browsers download the actual modules only when a bundle imports them.

`loadSnapshot` reads OPFS into a virtual snapshot. Call `registerSources` once per plugin to tie the snapshot to a source ID before compiling.

### 4. Boot a raw iframe

You can host Tiny UI manually by wiring an iframe straight to the Tiny UI runtime.

```html
<button id="load-plugin">Load plugin</button>
<iframe id="tiny-ui-iframe" title="tiny-ui" style="width: 100%; height: 420px; border: 1px solid #ccc;"></iframe>

<script type="module">
  import { compile, createTinyHost, loadSnapshot, setLockfile } from "@pstdio/tiny-ui";
  import { registerSources } from "@pstdio/tiny-ui-bundler";

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

  const hostApi = {
    "actions.log": async (params) => {
      console.log("[weather-ui] log", params?.message ?? "<no message>");
      return { ok: true };
    },
  };

  button.addEventListener("click", async () => {
    await loadSnapshot(source.root, source.entrypoint);
    registerSources([{ id: source.id, root: source.root, entry: source.entrypoint }]);

    const host = await createTinyHost(iframe, source.id);

    host.onOps(async ({ method, params }) => {
      const handler = hostApi[method];
      if (!handler) {
        throw new Error(`Unknown Tiny UI host method: ${method}`);
      }
      return handler(params);
    });

    host.onReady(({ meta }) => console.log("Plugin ready", meta));
    host.onError(({ message }) => console.error("Plugin failed", message));

    const compileResult = await compile(source.id, {
      wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
    });

    await host.sendInit(compileResult);
  });
</script>
```

### 5. Render the React wrapper

```tsx
import { setupTinyUI, TinyUI } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";
import runtimeUrl from "@pstdio/tiny-ui/dist/runtime.html?url";
import serviceWorkerUrl from "@pstdio/tiny-ui-bundler/dist/sw.js?url";

const hostApi = {
  "actions.log": (params?: Record<string, unknown>) => {
    console.log("[weather-ui]", params?.message ?? "<no message>");
    return { ok: true };
  },
};

registerSources([{ id: "weather-ui", root: "/plugins/weather-ui" }]);
void setupTinyUI({ runtimeUrl, serviceWorkerUrl }).catch(console.error);

function PluginFrame() {
  return (
    <TinyUI
      instanceId="weather-ui-runtime"
      sourceId="weather-ui"
      autoCompile
      onStatusChange={(status) => console.log("Tiny UI status", status)}
      onError={(error) => console.error(error)}
      onActionCall={(method, params) => {
        const handler = hostApi[method as keyof typeof hostApi];
        if (!handler) {
          throw new Error(`Unhandled Tiny UI host method: ${method}`);
        }

        return handler(params as Record<string, unknown> | undefined);
      }}
    />
  );
}
```

- `instanceId` uniquely identifies the iframe host session (handy when rendering multiple instances).
- `sourceId` must match the ID you registered via `registerSources` when seeding the snapshot.
- Use `onActionCall` to forward `remote.ops` requests to your application API. Return a value or promise just like any async function.
- Call `useTinyUIServiceWorker` anywhere in your tree to read the shared service worker lifecycle (status, readiness, errors).

### 6. Handle `remote.ops` requests

Plugins communicate with the host by calling `remote.ops` (for example through `host.actions.*`). Your React wrapper receives each call through `onActionCall(method, params)`. Forward the request to whatever API surface your application exposes, and return a result or throw to reject the call.

### Manual host integration with precompiled bundle

```ts
import { createTinyHost } from "@pstdio/tiny-ui";

const iframe = document.querySelector("iframe#plugin")!;
const host = await createTinyHost(iframe, "sql-explorer");

const hostApi = {
  "actions.log": (params?: Record<string, unknown>) => {
    console.log("[sql-explorer]", params?.message ?? "<no message>");
    return { ok: true };
  },
};

host.onOps(async ({ method, params }) => {
  const handler = hostApi[method as keyof typeof hostApi];
  if (!handler) throw new Error(`Unhandled Tiny UI host method: ${method}`);
  return handler(params as Record<string, unknown> | undefined);
});

host.onReady(({ meta }) => console.log("Plugin ready", meta));
host.onError(({ message }) => console.error("Plugin failed", message));

const compileResult = await fetch("/precompiled/sql-explorer.json").then((res) => res.json());

await host.sendInit(compileResult);
```

### Instant iframe boot from the cache manifest

If you previously compiled a plugin and the service worker still holds the bundle, you can skip `compile` entirely and boot straight from the cache manifest.

```ts
import { compile, createTinyHost, getCachedBundle, loadSnapshot } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";

const pluginId = "sql-explorer";
const iframe = document.querySelector("iframe#plugin")!;
const host = await createTinyHost(iframe, pluginId);

const hostApi = {
  "actions.log": (params?: Record<string, unknown>) => {
    console.log("[sql-explorer]", params?.message ?? "<no message>");
    return { ok: true };
  },
};

host.onOps(async ({ method, params }) => {
  const handler = hostApi[method as keyof typeof hostApi];
  if (!handler) throw new Error(`Unhandled Tiny UI host method: ${method}`);
  return handler(params as Record<string, unknown> | undefined);
});

let result = await getCachedBundle(pluginId);

if (!result) {
  const source = {
    id: pluginId,
    root: "/plugins/weather-ui",
    entrypoint: "/index.tsx",
  };

  await loadSnapshot(source.root, source.entrypoint);
  registerSources([{ id: source.id, root: source.root, entry: source.entrypoint }]);

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
import { CACHE_NAME, TinyUI, loadSnapshot, setupTinyUI } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";

async function bootPlugin() {
  void setupTinyUI({ serviceWorkerUrl: "/tiny-ui-sw.js" }).catch(console.error);

  await loadSnapshot("plugins/notepad", "/index.tsx");
  registerSources([{ id: "notepad", root: "/plugins/notepad" }]);

  render(
    <TinyUI
      instanceId="notepad-host"
      sourceId="notepad"
      onActionCall={(method, params) => {
        console.log("Unhandled request", method, params);
        return { ok: true };
      }}
    />,
  );
}

async function invalidateBundles() {
  if (typeof caches === "undefined") return;
  await caches.delete(CACHE_NAME);
}
```

## 📖 API

- `setupTinyUI(options)` – configure Tiny UI once per page (registers the service worker, sets the runtime URL, and primes global state).
- `setupServiceWorker(options)` – lower-level helper to register only the service worker.
- `getTinyUIRuntimePath()` – current runtime iframe URL resolved from `setupTinyUI`.
- `TinyUI(props)` – React component that compiles snapshots and boots the runtime iframe. Accepts lifecycle callbacks, `autoCompile`, and an `onActionCall` handler for host RPCs.
- `TinyUIStatus` – status union (`"idle" | "initializing" | "service-worker-ready" | "compiling" | "handshaking" | "ready" | "error"`).
- `useTinyUIServiceWorker()` – React hook that exposes the shared service worker lifecycle (`status`, `serviceWorkerReady`, and `error`).
- `registerVirtualSnapshot(root, snapshot)` / `unregisterVirtualSnapshot(root)` – cache the in-memory file tree Tiny UI will compile.
- `loadSnapshot(folder, entry)` – convenience helper that reads OPFS into a snapshot and registers it.
- `setLockfile(lockfile)` / `getLockfile()` / `resetStats()` / `getStats()` – manage remote module metadata and runtime counters.
- `buildImportMap(lockfile)` – convert a lockfile into an import map for the runtime iframe.
- `createTinyHost(iframe, id)` – low-level host connector exposing `sendInit`, `onReady`, `onError`, `onOps`, and `disconnect`.
- `CACHE_NAME`, `getRuntimeHtmlPath()`, `getVirtualPrefix()`, `getManifestUrl()` – helpers that mirror the service worker config.
