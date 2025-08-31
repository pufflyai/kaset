import "fake-indexeddb/auto";
import { vi } from "vitest";

// Mock the Web Crypto API
Object.defineProperty(globalThis, "crypto", {
  value: {
    subtle: {
      digest: vi.fn((_algorithm: string, data: ArrayBuffer) => {
        // Simple mock hash for testing
        const hash = new Uint8Array(32);
        const view = new DataView(data);
        for (let i = 0; i < Math.min(data.byteLength, 32); i++) {
          hash[i] = view.getUint8(i);
        }
        return Promise.resolve(hash.buffer);
      }),
    },
  },
});

// Mock File System Access API
const createMockFileHandle = (name: string, content: string = "", lastModified: number = Date.now()) => {
  const blob = new Blob([content], { type: "text/plain" });
  return {
    name,
    kind: "file" as const,
    getFile: vi.fn(() => Promise.resolve(new File([blob], name, { lastModified }))),
    createWritable: vi.fn(() =>
      Promise.resolve({
        write: vi.fn(),
        close: vi.fn(),
      } as any),
    ),
    isSameEntry: vi.fn(),
  } as any as FileSystemFileHandle;
};

const createMockDirectoryHandle = (name: string = "", entries: Map<string, any> = new Map()) => {
  return {
    name,
    kind: "directory" as const,
    values: vi.fn(function* () {
      for (const entry of entries.values()) {
        yield entry;
      }
    }),
    getFileHandle: vi.fn((name: string, options?: { create?: boolean }) => {
      if (entries.has(name) && entries.get(name).kind === "file") {
        return Promise.resolve(entries.get(name));
      }
      if (options?.create) {
        const handle = createMockFileHandle(name);
        entries.set(name, handle);
        return Promise.resolve(handle);
      }
      throw new Error(`File not found: ${name}`);
    }),
    getDirectoryHandle: vi.fn((name: string, options?: { create?: boolean }) => {
      if (entries.has(name) && entries.get(name).kind === "directory") {
        return Promise.resolve(entries.get(name));
      }
      if (options?.create) {
        const handle = createMockDirectoryHandle(name);
        entries.set(name, handle);
        return Promise.resolve(handle);
      }
      throw new Error(`Directory not found: ${name}`);
    }),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    isSameEntry: vi.fn(),
  } as any as FileSystemDirectoryHandle;
};

// Export test utilities
export { createMockFileHandle, createMockDirectoryHandle };
