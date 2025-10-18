import type { ScopedFs } from "@pstdio/opfs-utils";

const SETTINGS_FILE = ".settings.json";

function isMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const name = (error as { name?: string }).name;
  return code === "ENOENT" || name === "NotFoundError" || name === "NotFound";
}

export function createSettings(fs: ScopedFs, onChange: (value: unknown) => void) {
  return {
    async read<T = unknown>(): Promise<T> {
      try {
        return (await fs.readJSON<T>(SETTINGS_FILE)) as T;
      } catch (error) {
        if (!isMissingError(error) && !(error instanceof SyntaxError)) {
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
