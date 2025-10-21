import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostApi, Manifest, PluginChangePayload } from "../core/types";

vi.mock("@pstdio/opfs-utils", () => ({
  normalizeRoot: vi.fn(
    (value?: string | null, options?: { fallback?: string }) => value ?? options?.fallback ?? "plugins",
  ),
}));

vi.mock("../adapters/tiny-ai-tasks", () => ({
  createToolsForCommands: vi.fn(),
}));

vi.mock("../core/host", () => ({
  createHost: vi.fn(),
}));

import { normalizeRoot } from "@pstdio/opfs-utils";
import { createToolsForCommands } from "../adapters/tiny-ai-tasks";
import { createHost } from "../core/host";
import type { PluginSurfacesSnapshot } from "./pluginHostRuntime";
import { createPluginHostRuntime, getPluginSurfaces } from "./pluginHostRuntime";

describe("getPluginSurfaces", () => {
  it("returns a clone of surface data when provided", () => {
    const surfaces = { panel: { title: "Alpha" } };
    const manifest = createManifest({ surfaces });

    const snapshot = getPluginSurfaces(manifest);

    expect(snapshot).toEqual(surfaces);
    expect(snapshot).not.toBe(surfaces);

    snapshot!["panel"] = { title: "Changed" };
    expect(manifest.surfaces).toEqual({ panel: { title: "Alpha" } });
  });

  it("returns undefined when surfaces are not a record", () => {
    const manifest = createManifest({ surfaces: [1, 2, 3] as unknown });
    expect(getPluginSurfaces(manifest)).toBeUndefined();
  });
});

describe("createPluginHostRuntime", () => {
  const normalizeRootMock = vi.mocked(normalizeRoot);
  const createHostMock = vi.mocked(createHost);
  const createToolsForCommandsMock = vi.mocked(createToolsForCommands);

  beforeEach(() => {
    vi.clearAllMocks();
    normalizeRootMock.mockImplementation(
      (value?: string | null, options?: { fallback?: string }) => value ?? options?.fallback ?? "plugins",
    );
    createToolsForCommandsMock.mockReturnValue([{ name: "tool" } as unknown as never]);
  });

  it("collects plugin surfaces and notifies subscribers of updates", async () => {
    const manifest = createManifest({
      surfaces: {
        panel: { title: "Alpha" },
      },
    });

    const fixture = createHostFixture(manifest);
    createHostMock.mockReturnValue(fixture.host as never);

    const runtime = createPluginHostRuntime({ root: "rootA" });
    const snapshots: PluginSurfacesSnapshot[] = [];

    runtime.subscribeToPluginSurfaces((snapshot) => {
      snapshots.push(snapshot);
    });

    await runtime.ensureHost();

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toEqual([]);
    expect(snapshots[1]).toEqual([
      {
        pluginId: manifest.id,
        surfaces: { panel: { title: "Alpha" } },
      },
    ]);

    const mutatedSurfaces = snapshots[1][0].surfaces as Record<string, unknown>;
    mutatedSurfaces["panel"] = { title: "Changed" };
    expect(runtime.getPluginSurfaces()).toEqual([
      {
        pluginId: manifest.id,
        surfaces: { panel: { title: "Alpha" } },
      },
    ]);

    const updatedManifest = createManifest({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      surfaces: { dashboard: { title: "Updated" } },
    });

    fixture.emitPluginChange(manifest.id, {
      manifest: updatedManifest,
      paths: [],
      files: [],
      changes: [{ type: "modified", path: ["manifest.json"] }] as any,
    });

    expect(snapshots).toHaveLength(3);
    expect(snapshots[2]).toEqual([
      {
        pluginId: manifest.id,
        surfaces: { dashboard: { title: "Updated" } },
      },
    ]);

    fixture.emitPluginChange(manifest.id, {
      manifest: createManifest({ id: manifest.id, surfaces: undefined }),
      paths: [],
      files: [],
      changes: [],
    });

    expect(snapshots).toHaveLength(4);
    expect(snapshots[3]).toEqual([]);
  });

  it("normalizes change payloads for plugin file listeners", async () => {
    const manifest = createManifest();
    const fixture = createHostFixture(manifest);
    createHostMock.mockReturnValue(fixture.host as never);

    const runtime = createPluginHostRuntime({ root: "rootB" });
    const events: Array<{ pluginId: string; changes: Array<{ type: string; path: string[] }> }> = [];

    runtime.subscribeToPluginFiles(manifest.id, (event) => {
      events.push({
        pluginId: event.pluginId,
        changes: event.changes.map((change) => ({ type: change.type, path: change.path })),
      });
    });

    await runtime.ensureHost();

    const originalChange = { type: "modified", path: ["manifest.json"] } as const;
    fixture.emitPluginChange(manifest.id, {
      manifest,
      paths: [],
      files: [],
      changes: [originalChange] as any,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      pluginId: manifest.id,
      changes: [{ type: "modified", path: ["manifest.json"] }],
    });
    expect(events[0].changes[0].path).not.toBe(originalChange.path);

    events[0].changes[0].path.push("extra");

    fixture.emitPluginChange(manifest.id, {
      manifest,
      paths: ["folder/file.txt"],
      files: [],
      changes: undefined,
    });

    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({
      pluginId: manifest.id,
      changes: [{ type: "unknown", path: ["folder", "file.txt"] }],
    });
  });
});

function createManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    id: "alpha",
    name: "Alpha Plugin",
    version: "1.0.0",
    api: "v1",
    entry: "index.js",
    commands: [{ id: "run", title: "Run" }],
    surfaces: { panel: { title: "Default" } },
    ...overrides,
  } as Manifest;
}

function createHostFixture(manifest: Manifest) {
  const pluginChangeHandlers: Array<(pluginId: string, payload: PluginChangePayload) => void> = [];
  const dependencyHandlers: Array<(deps: Record<string, string>) => void> = [];

  const host = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    listCommands: vi.fn(() => [{ pluginId: manifest.id, id: "run", title: "Run" }]),
    getMetadata: vi.fn(() => [{ id: manifest.id, name: manifest.name, version: manifest.version }]),
    getPluginDependencies: vi.fn(() => ({ react: "cdn/react.js" })),
    onPluginChange: vi.fn((listener: (pluginId: string, payload: PluginChangePayload) => void) => {
      pluginChangeHandlers.push(listener);
      return () => {
        const index = pluginChangeHandlers.indexOf(listener);
        if (index >= 0) pluginChangeHandlers.splice(index, 1);
      };
    }),
    onDependencyChange: vi.fn((listener: (deps: Record<string, string>) => void) => {
      dependencyHandlers.push(listener);
      return () => {
        const index = dependencyHandlers.indexOf(listener);
        if (index >= 0) dependencyHandlers.splice(index, 1);
      };
    }),
    runCommand: vi.fn(async () => {}),
    readSettings: vi.fn(async () => ({})),
    updateSettings: vi.fn(async () => {}),
    createHostApiFor: vi.fn(() => {
      const api = {
        call: vi.fn(async (method: string, params?: { path?: string }) => {
          if (method !== "fs.readFile") throw new Error(`Unexpected method: ${method}`);
          const path = params?.path;
          if (path !== "manifest.json") throw new Error(`Unexpected path: ${path}`);
          return new TextEncoder().encode(JSON.stringify(manifest));
        }),
      };
      return api as HostApi;
    }),
  };

  return {
    host,
    emitPluginChange(pluginId: string, payload: PluginChangePayload) {
      pluginChangeHandlers.forEach((handler) => handler(pluginId, payload));
    },
    emitDependencyChange(deps: Record<string, string>) {
      dependencyHandlers.forEach((handler) => handler(deps));
    },
  };
}
