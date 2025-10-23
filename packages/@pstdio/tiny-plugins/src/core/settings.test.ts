import type { ScopedFs } from "@pstdio/opfs-utils";
import type { ValidateFunction } from "ajv";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSettings, createSettingsAccessor } from "./settings";
import { deriveSettingsDefaults } from "./settings-defaults";

function createFs(overrides?: {
  onRead?: (path: string) => Promise<unknown>;
  onWrite?: (path: string, value: unknown) => void | Promise<void>;
}) {
  let storedValue: unknown;
  const fs: ScopedFs = {
    async readJSON<T = unknown>(path: string) {
      if (overrides?.onRead) return (await overrides.onRead(path)) as T;
      if (storedValue === undefined) {
        const error = new Error("missing");
        (error as { code?: string }).code = "ENOENT";
        throw error;
      }
      if (storedValue instanceof Error) throw storedValue;
      return storedValue as T;
    },
    async writeJSON(path: string, value: unknown, __pretty?: boolean) {
      storedValue = value;
      await overrides?.onWrite?.(path, value);
    },
    // Minimal ScopedFs implementation for testing settings behavior.
    async readFile(_path: string) {
      throw new Error("not implemented");
    },
    async writeFile(_path: string) {
      throw new Error("not implemented");
    },
    async readdir(_path?: string) {
      throw new Error("not implemented");
    },
    async deleteFile(_path: string) {
      throw new Error("not implemented");
    },
    async moveFile(_from: string, _to: string) {
      throw new Error("not implemented");
    },
    async exists(_path: string) {
      throw new Error("not implemented");
    },
    async mkdirp(_path: string) {
      throw new Error("not implemented");
    },
  };

  return { fs, setValue: (value: unknown) => (storedValue = value) };
}

function createValidator() {
  const validator = ((value: unknown) =>
    typeof value === "object" &&
    value !== null &&
    (value as { enabled?: boolean }).enabled === true) as ValidateFunction;
  validator.errors = null;
  return validator;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSettings", () => {
  it("returns an empty object when the settings file is missing", async () => {
    const { fs } = createFs();
    const onChange = vi.fn();
    const settings = createSettings(fs, { onChange });

    const value = await settings.read<{ theme?: string }>();

    expect(value).toEqual({});
    expect(onChange).not.toHaveBeenCalled();
  });

  it("writes settings and emits changes", async () => {
    const onWrite = vi.fn();
    const { fs } = createFs({ onWrite });
    const onChange = vi.fn();
    const settings = createSettings(fs, { onChange });

    const payload = { theme: "dark" };
    await settings.write(payload);

    expect(onWrite).toHaveBeenCalledWith(".settings.json", payload);
    expect(onChange).toHaveBeenCalledWith(payload);
  });

  it("treats malformed settings content as empty", async () => {
    const { fs, setValue } = createFs();
    setValue(new SyntaxError("invalid json"));
    const settings = createSettings(fs, { onChange: vi.fn() });

    const value = await settings.read();

    expect(value).toEqual({});
  });

  it("seeds defaults when the settings file is missing", async () => {
    const seeded = { theme: "light" };
    const seed = vi.fn().mockResolvedValue(seeded);
    const onWrite = vi.fn();
    const { fs } = createFs({ onWrite });
    const onChange = vi.fn();
    const settings = createSettings(fs, { onChange, seed });

    const value = await settings.read<{ theme: string }>();

    expect(seed).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledWith(".settings.json", seeded);
    expect(onChange).toHaveBeenCalledWith(seeded);
    expect(value).toEqual(seeded);
  });

  it("does not overwrite existing settings when present", async () => {
    const { fs, setValue } = createFs();
    setValue({ theme: "dark" });
    const seed = vi.fn();
    const onChange = vi.fn();
    const settings = createSettings(fs, { onChange, seed });

    const value = await settings.read();

    expect(seed).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(value).toEqual({ theme: "dark" });
  });

  it("logs and falls back when seeding fails", async () => {
    const seedError = new Error("boom");
    const seed = vi.fn().mockRejectedValue(seedError);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fs } = createFs();
    const onChange = vi.fn();
    const settings = createSettings(fs, { onChange, seed });

    const value = await settings.read();

    expect(seed).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(value).toEqual({});
    expect(warn).toHaveBeenCalledWith("[tiny-plugins] failed to seed default settings", seedError);
    warn.mockRestore();
  });
});

describe("createSettingsAccessor", () => {
  it("validates settings on read", async () => {
    const { fs, setValue } = createFs();
    setValue({ enabled: false });
    const validator = createValidator();
    const accessor = createSettingsAccessor(fs, "test-plugin", validator);

    await expect(accessor.read()).rejects.toThrowError("Invalid settings for test-plugin");
  });

  it("validates settings on write", async () => {
    const { fs } = createFs();
    const validator = createValidator();
    const accessor = createSettingsAccessor(fs, "test-plugin", validator);

    await expect(accessor.write({ enabled: false })).rejects.toThrowError("Invalid settings for test-plugin");
  });

  it("allows valid settings", async () => {
    const { fs, setValue } = createFs();
    const validator = createValidator();
    const accessor = createSettingsAccessor(fs, "test-plugin", validator);

    await accessor.write({ enabled: true });
    setValue({ enabled: true });

    const value = await accessor.read();

    expect(value).toEqual({ enabled: true });
  });
});

describe("deriveSettingsDefaults", () => {
  it("derives nested defaults from the schema", () => {
    const schema = {
      type: "object",
      properties: {
        theme: { type: "string", default: "light" },
        nested: {
          type: "object",
          default: {},
          properties: {
            enabled: { type: "boolean", default: true },
          },
        },
      },
    };

    const defaults = deriveSettingsDefaults(schema);

    expect(defaults).toEqual({ theme: "light", nested: { enabled: true } });
  });

  it("returns a fresh clone on each call", () => {
    const schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          default: ["a", "b"],
          items: { type: "string" },
        },
      },
    };

    const first = deriveSettingsDefaults(schema);
    const second = deriveSettingsDefaults(schema);

    expect(first).toEqual({ tags: ["a", "b"] });
    expect(second).toEqual({ tags: ["a", "b"] });

    (first as { tags: string[] }).tags.push("c");

    expect(second).toEqual({ tags: ["a", "b"] });
  });

  it("logs and returns undefined for invalid schema types", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const defaults = deriveSettingsDefaults("nope");

    expect(defaults).toBeUndefined();
    expect(warn).toHaveBeenCalledWith("[tiny-plugins] settings defaults seeding skipped: invalid schema", "nope");
  });

  it("logs and returns undefined when validation fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const schema = {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
      },
    };

    const defaults = deriveSettingsDefaults(schema);

    expect(defaults).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "[tiny-plugins] settings defaults seeding skipped: schema validation failed",
      expect.any(Array),
    );
  });
});
