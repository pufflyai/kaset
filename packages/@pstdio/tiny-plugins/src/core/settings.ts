import type { ScopedFs } from "@pstdio/opfs-utils";
import { ValidateFunction } from "ajv";

const SETTINGS_FILE = ".settings.json";

interface CreateSettingsOptions {
  seed?: () => Promise<unknown>;
}

function isMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const name = (error as { name?: string }).name;
  return code === "ENOENT" || name === "NotFoundError" || name === "NotFound";
}

export function createSettings(fs: ScopedFs, onChange: (value: unknown) => void, options?: CreateSettingsOptions) {
  return {
    async read<T = unknown>(): Promise<T> {
      try {
        return (await fs.readJSON<T>(SETTINGS_FILE)) as T;
      } catch (error) {
        if (isMissingError(error)) {
          if (!options?.seed) return {} as T;
          try {
            const defaults = await options.seed();
            if (defaults === undefined) return {} as T;
            await fs.writeJSON(SETTINGS_FILE, defaults, true);
            onChange(defaults);
            return defaults as T;
          } catch (seedError) {
            console.warn("[tiny-plugins] failed to seed settings", seedError);
            return {} as T;
          }
        }
        if (!(error instanceof SyntaxError)) {
          console.warn("[tiny-plugins] failed to read settings", error);
        }
        return {} as T;
      }
    },
    async write<T = unknown>(value: T): Promise<void> {
      await fs.writeJSON(SETTINGS_FILE, value, true);
      onChange(value);
    },
  };
}

export function createSettingsAccessor(fs: ScopedFs, pluginId: string, validator?: ValidateFunction) {
  const settings = createSettings(fs, () => undefined);

  return {
    async read<T = unknown>(): Promise<T> {
      const value = await settings.read<T>();
      if (!validator) return value;
      const valid = validator(value);
      if (!valid) {
        throw new Error(`Invalid settings for ${pluginId}`);
      }
      return value;
    },
    async write<T = unknown>(value: T): Promise<void> {
      if (validator) {
        const valid = validator(value);
        if (!valid) {
          throw new Error(`Invalid settings for ${pluginId}`);
        }
      }
      await settings.write(value);
    },
  };
}
