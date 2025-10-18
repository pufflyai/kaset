import type { ScopedFs } from "@pstdio/opfs-utils";
import type { ValidateFunction } from "ajv";
import { createSettings } from "./core/settings";

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
