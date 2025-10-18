declare module "semver" {
  export interface SemVer {
    major: number;
    minor: number;
    patch: number;
    version: string;
  }

  export function parse(version: string, options?: { loose?: boolean }): SemVer | null;
  export function valid(version: string, options?: { loose?: boolean }): string | null;
  export function validRange(range: string, options?: { loose?: boolean }): string | null;
  export function satisfies(version: string, range: string, options?: { loose?: boolean }): boolean;
}
