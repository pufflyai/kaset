import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostState } from "./internalTypes";
import type { Manifest } from "../types";

const settingsModule = vi.hoisted(() => ({
  createSettingsMock: vi.fn(),
}));

const defaultsModule = vi.hoisted(() => ({
  deriveSettingsDefaultsMock: vi.fn(),
}));

const fsModule = vi.hoisted(() => ({
  createPluginFsMock: vi.fn(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    moveFile: vi.fn(),
    exists: vi.fn(),
    mkdirp: vi.fn(),
  })),
  createPluginDataFsMock: vi.fn(() => ({})),
}));

vi.mock("../settings", () => ({
  createSettings: settingsModule.createSettingsMock,
}));

vi.mock("../settings-defaults", () => ({
  deriveSettingsDefaults: defaultsModule.deriveSettingsDefaultsMock,
}));

vi.mock("../fs", () => ({
  createPluginFs: fsModule.createPluginFsMock,
  createPluginDataFs: fsModule.createPluginDataFsMock,
}));

import { buildHostApi } from "./hostApi";

const { createSettingsMock } = settingsModule;
const { deriveSettingsDefaultsMock } = defaultsModule;
const { createPluginFsMock, createPluginDataFsMock } = fsModule;

function createManifest(overrides?: Partial<Manifest>): Manifest {
  return {
    id: "test",
    name: "Test",
    version: "1.0.0",
    api: "v1",
    entry: "index.js",
    ...overrides,
  };
}

describe("buildHostApi", () => {
  beforeEach(() => {
    createSettingsMock.mockReset();
    deriveSettingsDefaultsMock.mockReset();
    createPluginFsMock.mockClear();
    createPluginDataFsMock.mockClear();
    createSettingsMock.mockImplementation(() => ({
      read: vi.fn(),
      write: vi.fn(),
    }));
  });

  it("provides a seeder when settings schema is available", async () => {
    const schema = { type: "object" };
    const manifest = createManifest({ settingsSchema: schema });
    const states = new Map<string, HostState>();
    states.set("test", { manifest } as HostState);
    deriveSettingsDefaultsMock.mockReturnValue({ theme: "light" });

    buildHostApi({
      root: "root",
      dataRoot: "data",
      pluginId: "test",
      emitter: { emit: vi.fn() } as any,
      notify: undefined,
      states,
    });

    expect(createSettingsMock).toHaveBeenCalledTimes(1);
    const [, options] = createSettingsMock.mock.calls[0];
    expect(typeof options.seed).toBe("function");
    await options.seed?.();
    expect(deriveSettingsDefaultsMock).toHaveBeenCalledWith(schema);
  });

  it("omits the seeder when no schema is present", () => {
    const states = new Map<string, HostState>();
    states.set("test", { manifest: createManifest({ settingsSchema: undefined }) } as HostState);

    buildHostApi({
      root: "root",
      dataRoot: "data",
      pluginId: "test",
      emitter: { emit: vi.fn() } as any,
      notify: undefined,
      states,
    });

    const [, options] = createSettingsMock.mock.calls[0];
    expect(options.seed).toBeUndefined();
  });

  it("uses the manifest override when state has not been populated", async () => {
    const schema = { type: "object" };
    const manifest = createManifest({ settingsSchema: schema });
    const states = new Map<string, HostState>();
    deriveSettingsDefaultsMock.mockReturnValue({ theme: "light" });

    buildHostApi({
      root: "root",
      dataRoot: "data",
      pluginId: "test",
      emitter: { emit: vi.fn() } as any,
      notify: undefined,
      states,
      manifestOverride: manifest,
    });

    const [, options] = createSettingsMock.mock.calls[0];
    expect(typeof options.seed).toBe("function");
    await options.seed?.();
    expect(deriveSettingsDefaultsMock).toHaveBeenCalledWith(schema);
  });
});
