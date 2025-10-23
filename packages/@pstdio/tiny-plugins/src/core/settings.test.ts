import type { ScopedFs } from "@pstdio/opfs-utils";
import type { ValidateFunction } from "ajv";
import { describe, expect, it, vi } from "vitest";
import { createSettings, createSettingsAccessor } from "./settings";

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

describe("createSettings", () => {
  it("returns an empty object when the settings file is missing", async () => {
    const { fs } = createFs();
    const onChange = vi.fn();
    const settings = createSettings(fs, onChange);

    const value = await settings.read<{ theme?: string }>();

    expect(value).toEqual({});
    expect(onChange).not.toHaveBeenCalled();
  });

  it("seeds defaults when the settings file is missing", async () => {
    const onWrite = vi.fn();
    const { fs } = createFs({ onWrite });
    const onChange = vi.fn();
    const seed = vi.fn().mockResolvedValue({ theme: "light" });
    const settings = createSettings(fs, onChange, { seed });

    const value = await settings.read<{ theme?: string }>();

    expect(seed).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledWith(".settings.json", { theme: "light" });
    expect(onChange).toHaveBeenCalledWith({ theme: "light" });
    expect(value).toEqual({ theme: "light" });
  });

  it("does not overwrite existing settings when seeding is configured", async () => {
    const { fs, setValue } = createFs();
    const onChange = vi.fn();
    const seed = vi.fn();
    setValue({ theme: "dark" });
    const settings = createSettings(fs, onChange, { seed });

    const value = await settings.read<{ theme?: string }>();

    expect(seed).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(value).toEqual({ theme: "dark" });
  });

  it("logs a warning when seeding fails", async () => {
    const { fs } = createFs();
    const onChange = vi.fn();
    const seedError = new Error("failed");
    const seed = vi.fn().mockRejectedValue(seedError);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const settings = createSettings(fs, onChange, { seed });

    const value = await settings.read();

    expect(seed).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[tiny-plugins] failed to seed settings", seedError);
    expect(value).toEqual({});
    warn.mockRestore();
  });

  it("writes settings and emits changes", async () => {
    const onWrite = vi.fn();
    const { fs } = createFs({ onWrite });
    const onChange = vi.fn();
    const settings = createSettings(fs, onChange);

    const payload = { theme: "dark" };
    await settings.write(payload);

    expect(onWrite).toHaveBeenCalledWith(".settings.json", payload);
    expect(onChange).toHaveBeenCalledWith(payload);
  });

  it("treats malformed settings content as empty", async () => {
    const { fs, setValue } = createFs();
    setValue(new SyntaxError("invalid json"));
    const settings = createSettings(fs, vi.fn());

    const value = await settings.read();

    expect(value).toEqual({});
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
