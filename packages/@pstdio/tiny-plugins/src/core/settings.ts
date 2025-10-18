import type { ScopedFs } from "@pstdio/opfs-utils";

const SETTINGS_FILE = ".settings.json";

function isMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const name = (error as { name?: string }).name;
  return code === "ENOENT" || name === "NotFoundError" || name === "NotFound";
}

export function createSettings(fs: ScopedFs, onChange: (value: unknown) => void) {
  return {
    async read<T = unknown>() {
      try {
        return (await fs.readJSON<T>(SETTINGS_FILE)) as T;
      } catch (error) {
        if (isMissing(error)) return {} as T;
        if (error instanceof SyntaxError) return {} as T;
        throw error;
      }
    },
    async write<T = unknown>(value: T) {
      await fs.writeJSON(SETTINGS_FILE, value ?? null, true);
      onChange(value);
    },
  };
}
