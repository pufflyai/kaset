import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandDefinition, HostOptions, Manifest, PluginChangePayload, PluginMetadata } from "../core/types";
import { createPluginHostRuntime } from "./pluginHostRuntime";

const fakeTools = vi.hoisted(() => [
  {
    definition: { name: "alpha" },
    run: vi.fn(async () => undefined),
  },
]);

var recordedToolRunner: ((pluginId: string, commandId: string, params?: unknown) => Promise<void>) | undefined;

const createToolsForCommandsMock = vi.hoisted(() =>
  vi
    .fn(
      (
        _commands: Array<CommandDefinition & { pluginId: string }>,
        runner: (pluginId: string, commandId: string, params?: unknown) => Promise<void>,
      ) => {
        recordedToolRunner = runner;
        return fakeTools;
      },
    )
    .mockName("createToolsForCommands"),
);

vi.mock("../adapters/tiny-ai-tasks", () => ({
  createToolsForCommands: createToolsForCommandsMock,
}));

const normalizeRootMock = vi.hoisted(() =>
  vi
    .fn((value?: string, options?: { fallback?: string }) => value ?? options?.fallback ?? "normalized-root")
    .mockName("normalizeRoot"),
);

vi.mock("@pstdio/opfs-utils", () => ({
  normalizeRoot: normalizeRootMock,
}));

type HostCommand = CommandDefinition & { pluginId: string };

type MockHostConfig = {
  metadata?: PluginMetadata[];
  commands?: HostCommand[];
  manifests?: Record<string, Manifest>;
  dependencies?: Record<string, string>;
  readSettingsResult?: unknown;
};

interface MockHost {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  listCommands: ReturnType<typeof vi.fn>;
  getMetadata: ReturnType<typeof vi.fn>;
  createHostApiFor: ReturnType<typeof vi.fn>;
  getPluginDependencies: ReturnType<typeof vi.fn>;
  onPluginChange: ReturnType<typeof vi.fn>;
  onDependencyChange: ReturnType<typeof vi.fn>;
  runCommand: ReturnType<typeof vi.fn>;
  readSettings: ReturnType<typeof vi.fn>;
  updateSettings: ReturnType<typeof vi.fn>;
  emitPluginChange(pluginId: string, payload: PluginChangePayload): void;
  emitDependencyChange(deps: Record<string, string>): void;
  pluginChangeUnsubscribe: ReturnType<typeof vi.fn>;
  dependencyChangeUnsubscribe: ReturnType<typeof vi.fn>;
}

function createMockHost(config: MockHostConfig = {}): MockHost {
  const pluginChangeUnsubscribe = vi.fn();
  const dependencyChangeUnsubscribe = vi.fn();

  let pluginChangeListener: ((pluginId: string, payload: PluginChangePayload) => void) | undefined;
  let dependencyChangeListener: ((deps: Record<string, string>) => void) | undefined;

  const start = vi.fn(async () => undefined);
  const stop = vi.fn(async () => undefined);
  const listCommands = vi.fn(() => config.commands ?? []);
  const getMetadata = vi.fn(() => config.metadata ?? []);
  const getPluginDependencies = vi.fn(() => config.dependencies ?? {});
  const runCommand = vi.fn(async (pluginId: string, commandId: string, params?: unknown) => {
    return { pluginId, commandId, params };
  });
  const readSettings = vi.fn(async () => config.readSettingsResult ?? { theme: "light" });
  const updateSettings = vi.fn(async () => undefined);

  const createHostApiFor = vi.fn((pluginId: string) => {
    const manifest = config.manifests?.[pluginId];
    const manifestBytes = manifest ? new TextEncoder().encode(JSON.stringify(manifest)) : new Uint8Array();

    return {
      ["fs.readFile"]: vi.fn(async (path: string) => {
        if (path !== "manifest.json") {
          throw new Error(`Unsupported path ${path}`);
        }
        if (!manifest) {
          throw new Error(`Missing manifest for ${pluginId}`);
        }
        return manifestBytes;
      }),
    };
  });

  const onPluginChange = vi.fn((listener: (pluginId: string, payload: PluginChangePayload) => void) => {
    pluginChangeListener = listener;
    return pluginChangeUnsubscribe;
  });

  const onDependencyChange = vi.fn((listener: (deps: Record<string, string>) => void) => {
    dependencyChangeListener = listener;
    return dependencyChangeUnsubscribe;
  });

  return {
    start,
    stop,
    listCommands,
    getMetadata,
    createHostApiFor,
    getPluginDependencies,
    onPluginChange,
    onDependencyChange,
    runCommand,
    readSettings,
    updateSettings,
    emitPluginChange: (pluginId, payload) => {
      pluginChangeListener?.(pluginId, payload);
    },
    emitDependencyChange: (deps) => {
      dependencyChangeListener?.(deps);
    },
    pluginChangeUnsubscribe,
    dependencyChangeUnsubscribe,
  };
}

let nextHostFactory: ((options: HostOptions) => MockHost) | undefined;
let lastHostOptions: HostOptions | undefined;

const createHostMock = vi
  .fn((options: HostOptions) => {
    lastHostOptions = options;
    if (!nextHostFactory) throw new Error("Host factory not configured");
    return nextHostFactory(options);
  })
  .mockName("createHost");

vi.mock("../core/host", () => ({
  createHost: (options: HostOptions) => createHostMock(options),
}));

beforeEach(() => {
  vi.clearAllMocks();
  recordedToolRunner = undefined;
  nextHostFactory = undefined;
  lastHostOptions = undefined;
});

describe("createPluginHostRuntime", () => {
  it("initializes host state and exposes plugin metadata", async () => {
    const manifest: Manifest = {
      id: "alpha",
      name: "Alpha Plugin",
      version: "1.0.0",
      api: "v1",
      entry: "index.js",
      settingsSchema: { type: "object" },
      surfaces: { panel: { title: "Alpha" } },
    };

    const host = createMockHost({
      metadata: [{ id: "alpha", name: "Alpha Plugin", version: "1.0.0" }],
      commands: [
        {
          pluginId: "alpha",
          id: "cmd-1",
          title: "Run",
        },
      ],
      manifests: { alpha: manifest },
      dependencies: { react: "^18.2.0" },
      readSettingsResult: { theme: "light" },
    });

    nextHostFactory = () => host;

    const runtime = createPluginHostRuntime({ dataRoot: "plugin-data" });

    const commandListener = vi.fn();
    const unsubscribeCommands = runtime.subscribeToPluginCommands(commandListener);

    await runtime.ensureHost();

    expect(host.start).toHaveBeenCalledTimes(1);
    expect(runtime.isReady()).toBe(true);

    expect(commandListener).toHaveBeenNthCalledWith(1, []);
    expect(commandListener).toHaveBeenLastCalledWith([
      expect.objectContaining({ pluginId: "alpha", id: "cmd-1", pluginName: "Alpha Plugin" }),
    ]);

    expect(runtime.getPluginCommands()).toEqual([
      expect.objectContaining({ pluginId: "alpha", id: "cmd-1", pluginName: "Alpha Plugin" }),
    ]);
    expect(createToolsForCommandsMock).toHaveBeenCalledWith(
      host.listCommands.mock.results[0].value,
      expect.any(Function),
    );
    const tools = runtime.getPluginTools();
    expect(tools).toHaveLength(fakeTools.length);
    expect(tools[0]).toBe(fakeTools[0]);

    expect(runtime.getPluginSettingsEntries()).toEqual([{ pluginId: "alpha", schema: manifest.settingsSchema }]);
    expect(runtime.getPluginSurfaces()).toEqual([{ pluginId: "alpha", surfaces: manifest.surfaces }]);
    expect(runtime.getMergedPluginDependencies()).toEqual({ react: "^18.2.0" });

    expect(runtime.getPluginDisplayName("alpha")).toBe("Alpha Plugin");
    expect(runtime.getPluginDisplayName("missing")).toBe("missing");
    expect(runtime.getPluginManifest("alpha")).toEqual(manifest);

    expect(recordedToolRunner).toBeDefined();
    await recordedToolRunner?.("alpha", "cmd-1", { value: 1 });
    expect(host.runCommand).toHaveBeenCalledWith("alpha", "cmd-1", { value: 1 });

    await runtime.readSettings("alpha");
    expect(host.readSettings).toHaveBeenCalledWith("alpha");

    await runtime.writeSettings("alpha", { theme: "dark" });
    expect(host.updateSettings).toHaveBeenCalledWith("alpha", { theme: "dark" });

    const dependencyListener = vi.fn();
    const unsubscribeDeps = runtime.subscribeToPluginDependencies(dependencyListener);
    expect(dependencyListener).toHaveBeenCalledWith({ react: "^18.2.0" });

    host.emitDependencyChange({ lodash: "^4.17.0" });
    expect(dependencyListener).toHaveBeenLastCalledWith({ lodash: "^4.17.0" });

    unsubscribeDeps();
    unsubscribeCommands();

    expect(runtime.getPluginsRoot()).toBe("plugins");
    expect(lastHostOptions).toMatchObject({ root: "plugins", dataRoot: "plugin-data" });
  });

  it("notifies plugin file listeners with normalized change records", async () => {
    const manifest: Manifest = {
      id: "alpha",
      name: "Alpha Plugin",
      version: "1.0.0",
      api: "v1",
      entry: "index.js",
      surfaces: { panel: { title: "Alpha" } },
    };

    const host = createMockHost({
      metadata: [{ id: "alpha", name: "Alpha Plugin", version: "1.0.0" }],
      manifests: { alpha: manifest },
    });

    nextHostFactory = () => host;

    const runtime = createPluginHostRuntime();
    await runtime.ensureHost();

    const fileListener = vi.fn();
    const unsubscribe = runtime.subscribeToPluginFiles("alpha", fileListener);

    host.emitPluginChange("alpha", {
      paths: ["folder/file.txt"],
      manifest,
      files: ["manifest.json", "folder/file.txt"],
    });

    expect(fileListener).toHaveBeenCalledWith({
      pluginId: "alpha",
      changes: [
        {
          type: "unknown",
          path: ["folder", "file.txt"],
        },
      ],
    });

    fileListener.mockClear();
    unsubscribe();

    host.emitPluginChange("alpha", {
      paths: ["other.txt"],
      manifest,
      files: ["other.txt"],
    });

    expect(fileListener).not.toHaveBeenCalled();
  });

  it("resets host state when changing the plugins root", async () => {
    const manifest: Manifest = {
      id: "alpha",
      name: "Alpha Plugin",
      version: "1.0.0",
      api: "v1",
      entry: "index.js",
    };

    const host = createMockHost({
      metadata: [{ id: "alpha", name: "Alpha Plugin", version: "1.0.0" }],
      commands: [
        {
          pluginId: "alpha",
          id: "cmd-1",
          title: "Run",
        },
      ],
      manifests: { alpha: manifest },
      dependencies: { react: "^18.2.0" },
    });

    nextHostFactory = () => host;

    const runtime = createPluginHostRuntime({ root: "initial" });
    await runtime.ensureHost();

    expect(runtime.getPluginsRoot()).toBe("initial");
    expect(runtime.getPluginCommands()).toHaveLength(1);

    await runtime.setPluginsRoot("next");

    expect(host.stop).toHaveBeenCalledTimes(1);
    expect(host.pluginChangeUnsubscribe).toHaveBeenCalledTimes(1);
    expect(host.dependencyChangeUnsubscribe).toHaveBeenCalledTimes(1);

    expect(runtime.isReady()).toBe(false);
    expect(runtime.getPluginCommands()).toEqual([]);
    expect(runtime.getPluginSettingsEntries()).toEqual([]);
    expect(runtime.getPluginSurfaces()).toEqual([]);
    expect(runtime.getMergedPluginDependencies()).toEqual({});
    expect(runtime.getPluginManifest("alpha")).toBeNull();
    expect(runtime.getPluginsRoot()).toBe("next");

    const nextHost = createMockHost();
    nextHostFactory = () => nextHost;

    await runtime.ensureHost();
    expect(createHostMock).toHaveBeenCalledTimes(2);
  });
});
