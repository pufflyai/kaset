import type { ValidateFunction } from "ajv";
import type { ScopedFs } from "../runtime/fs-opfs";
import { commandParamsInvalid } from "./errors";

const SETTINGS_FILE = ".settings.json";

type UnknownRecord = Record<string, unknown>;

function isMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const name = (error as { name?: string }).name;
  return code === "ENOENT" || name === "NotFoundError" || name === "NotFound";
}

export interface SettingsAccessor {
  read<T = unknown>(): Promise<T>;
  write<T = unknown>(value: T): Promise<void>;
}

export function createSettingsAccessor(fs: ScopedFs, pluginId: string, validator?: ValidateFunction): SettingsAccessor {
  return {
    async read<T = UnknownRecord>() {
      try {
        return (await fs.readJSON<T>(SETTINGS_FILE)) as T;
      } catch (error) {
        if (isMissingError(error)) return {} as T;

        if (error instanceof SyntaxError) return {} as T;
        return {} as T;
      }
    },
    async write<T = UnknownRecord>(value: T) {
      if (validator) {
        const valid = validator(value);
        if (!valid) {
          throw commandParamsInvalid(pluginId, "settings", validator.errors);
        }
      }

      await fs.writeJSON(SETTINGS_FILE, value, true);
    },
  } satisfies SettingsAccessor;
}
