declare module "micromatch" {
  export function isMatch(
    str: string,
    patterns: string | readonly string[],
    options?: { dot?: boolean; nocase?: boolean },
  ): boolean;
}

declare module "semver" {
  export function satisfies(version: string, range: string): boolean;
}
