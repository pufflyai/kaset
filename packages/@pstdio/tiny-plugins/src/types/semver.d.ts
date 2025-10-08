declare module "semver" {
  interface SemverParseOptions {
    loose?: boolean;
    includePrerelease?: boolean;
  }

  interface SemverSatisfiesOptions {
    loose?: boolean;
    includePrerelease?: boolean;
  }

  interface SemverRangeOptions {
    loose?: boolean;
  }

  interface SemverVersion {
    major: number;
    minor: number;
    patch: number;
  }

  export function parse(version: string, options?: SemverParseOptions): SemverVersion | null;
  export function satisfies(version: string, range: string, options?: SemverSatisfiesOptions): boolean;
  export function validRange(range: string, options?: SemverRangeOptions): string | null;
}
