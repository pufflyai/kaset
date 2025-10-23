import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Emitter } from "../events";
import type { Events, HostState } from "./internalTypes";
import type { Manifest } from "../types";

const createScopedFsMock = vi.fn(() => ({
  readJSON: vi.fn(),
  writeJSON: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  deleteFile: vi.fn(),
  moveFile: vi.fn(),
  exists: vi.fn(),
  mkdirp: vi.fn(),
}));

vi.mock("@pstdio/opfs-utils", () => ({
  createScopedFs: createScopedFsMock,
  joinUnderWorkspace: vi.fn((base: string, relative: string) => `${base}/${relative}`),
  normalizeRelPath: vi.fn((value: string) => value),
  normalizeSegments: vi.fn((value: string | string[]) => {
    if (Array.isArray(value)) return value;
    return `${value}`.split("/").filter(Boolean);
  }),
  ls: vi.fn(),
}));

const createSettingsMock = vi.fn();
vi.mock("../settings", () => ({
  createSettings: createSettingsMock,
}));

const deriveSettingsDefaultsMock = vi.fn();
vi.mock("../settings-defaults", () => ({
  deriveSettingsDefaults: deriveSettingsDefaultsMock,
}));

let buildHostApi: (typeof import("./hostApi"))["buildHostApi"];

beforeAll(async () => {
  ({ buildHostApi } = await import("./hostApi"));
});

beforeEach(() => {
  createScopedFsMock.mockClear();
  deriveSettingsDefaultsMock.mockReset();
  createSettingsMock.mockReset();
  createSettingsMock.mockImplementation(() => ({ read: vi.fn(), write: vi.fn() }));
});

describe("buildHostApi settings seeding", () => {
  it("provides a seeder when a settings schema is present", async () => {
    const manifest: Manifest = {
      id: "plugin-a",
      name: "Plugin A",
      version: "1.0.0",
      api: "v1",
      entry: "index.js",
      settingsSchema: { type: "object", properties: { flag: { type: "boolean", default: true } } },
    };
    const states = new Map<string, HostState>([["plugin-a", { manifest }]]);
    const emitter = new Emitter<Events>();
    deriveSettingsDefaultsMock.mockReturnValue({ flag: true });

    buildHostApi({
      root: "plugins",
      dataRoot: "plugin_data",
      workspaceRoot: "workspace",
      pluginId: "plugin-a",
      notify: undefined,
      emitter,
      states,
    });

    expect(createSettingsMock).toHaveBeenCalledTimes(1);
    const options = createSettingsMock.mock.calls[0]?.[2];
    expect(options?.seed).toBeTypeOf("function");

    await options?.seed?.();
    expect(deriveSettingsDefaultsMock).toHaveBeenCalledWith(manifest.settingsSchema);
  });

  it("omits the seeder when no schema is defined", () => {
    const manifest: Manifest = {
      id: "plugin-b",
      name: "Plugin B",
      version: "1.0.0",
      api: "v1",
      entry: "index.js",
    };
    const states = new Map<string, HostState>([["plugin-b", { manifest }]]);
    const emitter = new Emitter<Events>();

    buildHostApi({
      root: "plugins",
      dataRoot: "plugin_data",
      workspaceRoot: "workspace",
      pluginId: "plugin-b",
      notify: undefined,
      emitter,
      states,
    });

    expect(createSettingsMock).toHaveBeenCalledTimes(1);
    const options = createSettingsMock.mock.calls[0]?.[2];
    expect(options?.seed).toBeUndefined();
  });
});
