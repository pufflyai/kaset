import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeRecord } from "@pstdio/opfs-utils";
import type { Manifest } from "./types";

const lsMock = vi.fn();

vi.mock("@pstdio/opfs-utils", () => ({
  ls: lsMock,
}));

const readManifestStrictMock = vi.fn();

vi.mock("./manifest", () => ({
  readManifestStrict: readManifestStrictMock,
}));

const listFilesMock = vi.fn();
const watchPluginDirMock = vi.fn();
const watchPluginsRootMock = vi.fn();

vi.mock("./watchers", () => ({
  listFiles: listFilesMock,
  watchPluginDir: watchPluginDirMock,
  watchPluginsRoot: watchPluginsRootMock,
}));

const createPluginFsMock = vi.fn();
const createPluginDataFsMock = vi.fn();

vi.mock("./fs", () => ({
  createPluginFs: createPluginFsMock,
  createPluginDataFs: createPluginDataFsMock,
}));

const createSettingsMock = vi.fn();

vi.mock("./settings", () => ({
  createSettings: createSettingsMock,
}));

const commandRegistryRegisterMock = vi.fn();
const commandRegistryUnregisterMock = vi.fn();

const commandRegistryInstance = {
  register: commandRegistryRegisterMock,
  unregister: commandRegistryUnregisterMock,
  list: vi.fn(),
  listAll: vi.fn(),
  run: vi.fn(),
};

const commandRegistryConstructorMock = vi.fn(() => commandRegistryInstance);

vi.mock("./commands", () => ({
  CommandRegistry: commandRegistryConstructorMock,
}));

const pluginManifests = new Map<string, Manifest>();
const pluginSources = new Map<string, string>();
const pluginDirCallbacks = new Map<string, (changes: ChangeRecord[]) => Promise<void> | void>();

const encoder = new TextEncoder();

createPluginFsMock.mockImplementation((_root: string, pluginId: string) => ({
  readFile: (path: string) => {
    const key = `${pluginId}/${path}`;
    const source = pluginSources.get(key);
    if (source === undefined) throw new Error(`Missing source for ${key}`);
    return Promise.resolve(encoder.encode(source));
  },
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  moveFile: vi.fn(),
  exists: vi.fn(),
  mkdirp: vi.fn(),
}));

createPluginDataFsMock.mockReturnValue({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  moveFile: vi.fn(),
  exists: vi.fn(),
  mkdirp: vi.fn(),
});

createSettingsMock.mockImplementation(() => ({
  read: vi.fn(),
  write: vi.fn(),
}));

watchPluginDirMock.mockImplementation(async (root: string, cb: (changes: ChangeRecord[]) => void) => {
  const segments = root.split("/");
  const pluginId = segments[segments.length - 1];
  pluginDirCallbacks.set(pluginId, cb);
  return () => {
    pluginDirCallbacks.delete(pluginId);
  };
});

watchPluginsRootMock.mockResolvedValue(() => undefined);

listFilesMock.mockResolvedValue([]);

const readManifestImplementation = async (_reader: (path: string) => Promise<string>, pluginId: string) => {
  const manifest = pluginManifests.get(pluginId);
  if (!manifest) {
    return { ok: false, error: "missing", details: null } as const;
  }
  return { ok: true, manifest } as const;
};

readManifestStrictMock.mockImplementation(readManifestImplementation);

const revokeObjectURLMock = vi.fn();

class MockBlob {
  readonly code: string;

  constructor(parts: Array<string | ArrayBufferView | ArrayBuffer | MockBlob | undefined>, _options?: BlobPropertyBag) {
    this.code = parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (part instanceof ArrayBuffer) return Buffer.from(part).toString("utf8");
        if (ArrayBuffer.isView(part)) {
          const view = part as ArrayBufferView;
          return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString("utf8");
        }
        if (part instanceof MockBlob) return part.code;
        return String(part ?? "");
      })
      .join("");
  }
}

const originalBlob = globalThis.Blob;
const originalURL = globalThis.URL;
let urlCounter = 0;

beforeAll(() => {
  vi.stubGlobal("Blob", MockBlob as unknown as typeof Blob);
  vi.stubGlobal("URL", {
    createObjectURL: (blob: MockBlob) => {
      const encoded = Buffer.from(blob.code).toString("base64");
      return `data:text/javascript;base64,${encoded}#${urlCounter++}`;
    },
    revokeObjectURL: revokeObjectURLMock,
  } as unknown as typeof URL);
});

afterAll(() => {
  globalThis.Blob = originalBlob;
  globalThis.URL = originalURL;
});

beforeEach(() => {
  lsMock.mockReset();
  commandRegistryRegisterMock.mockClear();
  commandRegistryUnregisterMock.mockClear();
  commandRegistryConstructorMock.mockClear();
  revokeObjectURLMock.mockClear();
  urlCounter = 0;
  pluginManifests.clear();
  pluginSources.clear();
  pluginDirCallbacks.clear();
  (globalThis as Record<string, unknown>).__tinyPluginLifecycle = {};
});

function pluginCode(pluginId: string) {
  return `const lifecycle = globalThis.__tinyPluginLifecycle["${pluginId}"];\nexport const commands = {};\nexport default {\n  activate(ctx) { lifecycle.activate(ctx); },\n  deactivate() { lifecycle.deactivate(); }\n};`;
}

describe("createHost", () => {
  it("cleans up previous plugin instance before activating hot reloads", async () => {
    const { createHost } = await import("./host");

    const lifecycle = { activate: vi.fn(), deactivate: vi.fn() };
    (globalThis as any).__tinyPluginLifecycle = { test: lifecycle };

    pluginManifests.set("test", {
      id: "test",
      name: "Test",
      version: "1.0.0",
      entry: "index.js",
      commands: [],
    });

    pluginSources.set("test/index.js", pluginCode("test"));

    lsMock.mockResolvedValue([{ name: "test" }]);

    const host = createHost({ root: "plugins" });
    await host.start();

    expect(lifecycle.activate).toHaveBeenCalledTimes(1);

    const callback = pluginDirCallbacks.get("test");
    expect(callback).toBeDefined();

    await callback?.([
      {
        path: ["index.js"],
        type: "modified",
        handleKind: "file",
      } as ChangeRecord,
    ]);

    expect(lifecycle.deactivate).toHaveBeenCalledTimes(1);
    expect(lifecycle.activate).toHaveBeenCalledTimes(2);
    const deactivateOrder = lifecycle.deactivate.mock.invocationCallOrder[0];
    const secondActivateOrder = lifecycle.activate.mock.invocationCallOrder[1];
    expect(deactivateOrder).toBeLessThan(secondActivateOrder);
    const unregisterOrder = commandRegistryUnregisterMock.mock.invocationCallOrder[0];
    const secondRegisterOrder = commandRegistryRegisterMock.mock.invocationCallOrder[1];
    expect(unregisterOrder).toBeLessThan(secondRegisterOrder);
    expect(commandRegistryUnregisterMock).toHaveBeenCalledTimes(1);
    expect(commandRegistryRegisterMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);

    await callback?.([
      {
        path: ["index.js"],
        type: "modified",
        handleKind: "file",
      } as ChangeRecord,
    ]);

    expect(lifecycle.deactivate).toHaveBeenCalledTimes(2);
    expect(lifecycle.activate).toHaveBeenCalledTimes(3);
    expect(commandRegistryUnregisterMock).toHaveBeenCalledTimes(2);
    expect(commandRegistryRegisterMock).toHaveBeenCalledTimes(3);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
  });
});
