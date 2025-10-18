import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Manifest } from "./types";

type ManifestResult =
  | { ok: true; manifest: Manifest; warnings: string[] }
  | { ok: false; error: string; details?: unknown; warnings: string[] };

const { pluginRegistry, manifestBehaviors, pluginWatchers, rootWatcherRef, listFilesMock, lsMock } = vi.hoisted(() => {
  const pluginRegistry = new Map<string, { manifest: Manifest; files: Record<string, string> }>();
  const manifestBehaviors = new Map<string, () => ManifestResult>();
  const pluginWatchers = new Map<
    string,
    {
      onChange: (changes: Array<{ path: string[]; type: string; handleKind?: string }>) => Promise<void>;
      cleanup: ReturnType<typeof vi.fn>;
    }
  >();
  const rootWatcherRef: { cleanup?: ReturnType<typeof vi.fn> } = {};
  const listFilesMock = vi.fn(async () => [] as string[]);
  const lsMock = vi.fn(async () => Array.from(pluginRegistry.keys()).map((id) => ({ name: id })));

  return { pluginRegistry, manifestBehaviors, pluginWatchers, rootWatcherRef, listFilesMock, lsMock };
});

vi.mock("@pstdio/opfs-utils", () => ({
  ls: () => lsMock(),
}));

vi.mock("./fs", () => ({
  createPluginFs: (_root: string, pluginId: string) => ({
    async readFile(path: string) {
      const record = pluginRegistry.get(pluginId);
      if (!record) throw new Error(`missing plugin ${pluginId}`);
      if (path === "manifest.json") {
        return new TextEncoder().encode(JSON.stringify(record.manifest));
      }
      const contents = record.files[path];
      if (contents === undefined) throw new Error(`missing file ${pluginId}/${path}`);
      return new TextEncoder().encode(contents);
    },
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    moveFile: vi.fn(),
    exists: vi.fn(async () => true),
    mkdirp: vi.fn(),
  }),
  createPluginDataFs: () => ({
    readJSON: vi.fn(async () => ({})),
    writeJSON: vi.fn(async () => {}),
  }),
}));

vi.mock("./manifest", () => ({
  readManifestStrict: async (_readText: (path: string) => Promise<string>, pluginId: string) => {
    const responder = manifestBehaviors.get(pluginId);
    if (responder) return responder();
    const record = pluginRegistry.get(pluginId);
    if (!record) {
      return { ok: false, error: `missing manifest for ${pluginId}`, warnings: [] } as ManifestResult;
    }
    return { ok: true, manifest: record.manifest, warnings: [] } as ManifestResult;
  },
}));

vi.mock("./settings", () => ({
  createSettings: (_fs: unknown, onChange: (value: unknown) => void) => ({
    read: vi.fn(async () => ({})),
    write: vi.fn(async (value) => {
      onChange(value);
    }),
  }),
}));

vi.mock("./dependencies", () => ({
  mergeDependencies: (entries: Array<{ id?: string; dependencies?: Record<string, string> | undefined }>) => {
    const merged: Record<string, string> = {};
    for (const entry of entries) {
      Object.assign(merged, entry.dependencies ?? {});
    }
    return merged;
  },
}));

vi.mock("./watchers", () => ({
  listFiles: () => listFilesMock(),
  watchPluginDir: async (
    root: string,
    onChange: (changes: Array<{ path: string[]; type: string; handleKind?: string }>) => Promise<void> | void,
  ) => {
    const pluginId = root.split("/").pop();
    if (!pluginId) throw new Error("missing plugin id");
    const cleanup = vi.fn(async () => {});
    pluginWatchers.set(pluginId, {
      onChange: async (changes) => onChange(changes),
      cleanup,
    });
    return cleanup;
  },
  watchPluginsRoot: async () => {
    const cleanup = vi.fn(async () => {});
    rootWatcherRef.cleanup = cleanup;
    return cleanup;
  },
}));

const OriginalURL = globalThis.URL;

class MockBlob {
  readonly source: string;
  readonly size: number;
  readonly type: string;

  constructor(parts: BlobPart[], options?: BlobPropertyBag) {
    this.source = parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (part instanceof ArrayBuffer) return Buffer.from(part).toString("utf8");
        if (ArrayBuffer.isView(part)) return Buffer.from(part.buffer).toString("utf8");
        return String(part);
      })
      .join("");
    this.size = this.source.length;
    this.type = options?.type ?? "";
  }

  async text() {
    return this.source;
  }
}

const createObjectURLMock = vi.fn(
  (blob: MockBlob) => `data:text/javascript;charset=utf-8,${encodeURIComponent(blob.source)}`,
);
const revokeObjectURLMock = vi.fn();

function MockURL(input: string | URL, base?: string) {
  if (base !== undefined) {
    return new OriginalURL(input, base);
  }
  return new OriginalURL(input as string);
}

MockURL.prototype = OriginalURL.prototype;
(MockURL as unknown as typeof URL).createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
(MockURL as unknown as typeof URL).revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;

vi.stubGlobal("Blob", MockBlob as unknown as typeof Blob);
vi.stubGlobal("URL", MockURL as unknown as typeof URL);

const hostModulePromise = import("./host");

beforeEach(() => {
  pluginRegistry.clear();
  manifestBehaviors.clear();
  pluginWatchers.clear();
  delete rootWatcherRef.cleanup;
  listFilesMock.mockClear();
  lsMock.mockClear();
  lsMock.mockImplementation(async () => Array.from(pluginRegistry.keys()).map((id) => ({ name: id })));
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
});

describe("createHost watcher cleanup", () => {
  it("keeps watcher cleanup after multiple reloads", async () => {
    pluginRegistry.set("demo", {
      manifest: {
        id: "demo",
        name: "Demo",
        version: "1.0.0",
        api: "1.0.0",
        entry: "index.js",
        commands: [],
      },
      files: {
        "index.js": "export default { activate() {}, deactivate() {} };",
      },
    });

    const { createHost } = await hostModulePromise;
    const host = createHost({ root: "plugins", watch: true, hostApiVersion: "1.0.0" });

    await host.start();

    const watcher = pluginWatchers.get("demo");
    expect(watcher).toBeDefined();
    expect(watcher?.cleanup).toHaveBeenCalledTimes(0);

    for (let i = 0; i < 3; i++) {
      await watcher?.onChange?.([{ path: ["demo", "index.js"], type: "modified", handleKind: "file" }] as Array<{
        path: string[];
        type: string;
        handleKind?: string;
      }>);
    }

    await host.stop();

    expect(watcher?.cleanup).toHaveBeenCalledTimes(1);
  });

  it("retains watcher cleanup when manifest becomes invalid", async () => {
    pluginRegistry.set("demo", {
      manifest: {
        id: "demo",
        name: "Demo",
        version: "1.0.0",
        api: "1.0.0",
        entry: "index.js",
        commands: [],
      },
      files: {
        "index.js": "export default { activate() {}, deactivate() {} };",
      },
    });

    let calls = 0;
    manifestBehaviors.set("demo", () => {
      calls += 1;
      if (calls === 1) {
        const record = pluginRegistry.get("demo");
        if (!record) throw new Error("missing plugin");
        return { ok: true, manifest: record.manifest, warnings: [] } as ManifestResult;
      }
      return { ok: false, error: "invalid", warnings: [] } as ManifestResult;
    });

    const { createHost } = await hostModulePromise;
    const host = createHost({ root: "plugins", watch: true, hostApiVersion: "1.0.0" });

    await host.start();

    const watcher = pluginWatchers.get("demo");
    expect(watcher).toBeDefined();
    expect(watcher?.cleanup).toHaveBeenCalledTimes(0);

    await watcher?.onChange?.([{ path: ["demo", "manifest.json"], type: "modified", handleKind: "file" }] as Array<{
      path: string[];
      type: string;
      handleKind?: string;
    }>);

    await host.stop();

    expect(watcher?.cleanup).toHaveBeenCalledTimes(1);
  });
});
