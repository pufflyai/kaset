# Binding state managers to OPFS

`@pstdio/opfs-utils` now ships a tiny toolkit for treating an OPFS JSON file as the
source of truth for any state store. The pieces are intentionally modular:

- `createJsonFileStorage` – reads/writes a JSON file in OPFS, watches for external
  changes, and broadcasts updates across tabs.
- `bindStoreToJsonFile` – wires any store that exposes `read`, `replace`, and
  `subscribe` into that storage.
- Store adapters for Redux, Zustand, and Jotai.
- `useOpfsStoreBinding` – a React hook in `@pstdio/opfs-hooks` that manages the
  lifecycle for you.

All helpers accept a `filePath`, so you can choose exactly where your state
lives (e.g. `"app/workspace.json"`).

## 1. Creating a storage instance

```ts
import { createJsonFileStorage } from "@pstdio/opfs-utils";

const storage = createJsonFileStorage({
  defaultValue: { text: "hello", age: 42 },
  filePath: "app/state.json",
  debounceMs: 200,
  watchIntervalMs: 1000,
});
```

Key options:

- `defaultValue` – fallback when the file is missing or corrupt.
- `filePath` – required OPFS path (nested directories are allowed).
- `debounceMs` – throttle writes; defaults to 150 ms.
- `watchIntervalMs` – polling frequency for external changes (set `0` to disable).
- `migrate` – upgrade raw on-disk data to the current shape.
- `serialize`/`deserialize` – override JSON handling when needed.
- `broadcastChannelId` – customise or disable cross-tab notifications.

## 2. Binding any store

```ts
import { bindStoreToJsonFile } from "@pstdio/opfs-utils";

const dispose = await bindStoreToJsonFile(myStoreAdapter, storage, {
  reconcile: (file, memory) => ({ ...memory, ...file }),
  writeAfterHydrate: true,
});

// Later: stop syncing
dispose();
```

`bindStoreToJsonFile` hydrates the store from disk, optionally reconciles with
in-memory data, keeps OPFS updated when state changes, and applies external file
changes back into the store. Pass a custom `areEqual` comparator if plain
`JSON.stringify` comparisons are not sufficient.

## 3. Built-in store adapters

```ts
import { createReduxAdapter, createZustandAdapter, createJotaiAdapter } from "@pstdio/opfs-utils";
```

### Redux

```ts
const reduxAdapter = createReduxAdapter(store, hydrateAction);
await bindStoreToJsonFile(reduxAdapter, storage);
```

`hydrateAction(next)` should return an action that replaces the persisted slice
(e.g. `{ type: "HYDRATE", payload: next }`).

### Zustand

```ts
import type { StoreApi } from "zustand";

declare const store: StoreApi<MyState>;

const adapter = createZustandAdapter(store);
await bindStoreToJsonFile(adapter, storage, {
  reconcile: (file, memory) => ({ ...memory, ...file }),
});
```

The adapter uses `setState(next, true)` to replace the snapshot.

### Jotai

```ts
import { createStore } from "jotai/vanilla";
import { createJotaiAdapter } from "@pstdio/opfs-utils";

const store = createStore();
const adapter = createJotaiAdapter(store, rootAtom);
await bindStoreToJsonFile(adapter, storage);
```

If you are on an older Jotai version without `store.sub`, provide
`{ fallbackSubscribe: (listener) => manualUnsubscribe }`.

## 4. React convenience hook

`@pstdio/opfs-hooks` exposes `useOpfsStoreBinding` for component-driven setups.
Remember to memoise `storageOptions`/`bindOptions` so the effect only re-runs
when inputs change.

```tsx
import { useMemo } from "react";
import { useOpfsStoreBinding } from "@pstdio/opfs-hooks";
import { createZustandAdapter } from "@pstdio/opfs-utils";

function WorkspaceSync({ store }: { store: StoreApi<MyState> }) {
  const adapter = useMemo(() => createZustandAdapter(store), [store]);
  const storageOptions = useMemo(() => ({ defaultValue: INITIAL_STATE, filePath: "workspaces/state.json" }), []);

  useOpfsStoreBinding({
    store: adapter,
    storageOptions,
    bindOptions: {
      reconcile: (file, memory) => ({ ...memory, ...file }),
    },
  });

  return null;
}
```

## 5. Tips

- You can create multiple storage instances to persist different slices.
- Use `broadcastChannelId` when the same file is shared across separate apps.
- When a worker edits the file without BroadcastChannel support, lower the
  `watchIntervalMs` to catch updates quickly.
- For manual migrations, read the file once, transform it, and write back before
  starting the binding.
