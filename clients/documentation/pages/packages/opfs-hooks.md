---
title: "@pstdio/opfs-hooks"
---

# @pstdio/opfs-hooks

React hooks for working with the browser's Origin Private File System (OPFS).

## Install

```bash
npm i @pstdio/opfs-hooks
```

## Overview

The `@pstdio/opfs-hooks` package provides React hooks that make it easy to work with OPFS in your React applications. Built on top of [@pstdio/opfs-utils](/packages/opfs-utils), these hooks manage state synchronization, file watching, and provide a clean React API for filesystem operations.

---

## Core Hooks

### `useFolder`

Monitor a folder and its contents in OPFS.

```tsx
import { useFolder } from "@pstdio/opfs-hooks";

function FileTree() {
  const { rootNode, loading, error } = useFolder("docs");

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <pre>{JSON.stringify(rootNode, null, 2)}</pre>;
}
```

### `useFileContent`

Read and watch a specific file's content.

```tsx
import { useFileContent } from "@pstdio/opfs-hooks";

function Editor() {
  const { content, loading, error } = useFileContent("docs/readme.txt");

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <textarea value={content || ""} readOnly />;
}
```

### `useOpfsStoreBinding`

Bridge between Zustand stores and OPFS state files for automatic persistence.

```tsx
import { create } from "zustand";
import { useOpfsStoreBinding } from "@pstdio/opfs-hooks";

const useStore = create((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}));

function TodoApp() {
  useOpfsStoreBinding(useStore, "todos/state.json", {
    selector: (state) => ({ items: state.items }),
    debounceMs: 500,
  });

  const items = useStore((state) => state.items);

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
  );
}
```

---

## Features

- **Reactive updates**: Hooks automatically re-render when files or folders change
- **Type-safe**: Full TypeScript support with proper type inference
- **Error handling**: Built-in error states for robust UIs
- **Loading states**: Track async operations with loading flags
- **Integration**: Works seamlessly with [@pstdio/opfs-utils](/packages/opfs-utils) utilities

---

## Dependencies

- [@pstdio/opfs-utils](/packages/opfs-utils) - Core OPFS operations
- `react` - React 18+

---

## See Also

- [@pstdio/opfs-utils](/packages/opfs-utils) - Underlying OPFS utilities
- [@pstdio/opfs-sync](/packages/opfs-sync) - OPFS synchronization
- [Your App as a Filesystem](/concepts/filesystem) - Conceptual overview
