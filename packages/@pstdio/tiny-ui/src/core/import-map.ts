export type Lockfile = Record<string, string>;

export interface ImportMap {
  imports: Record<string, string>;
}

export const buildImportMap = (lockfile: Lockfile): ImportMap => ({ imports: { ...lockfile } });
