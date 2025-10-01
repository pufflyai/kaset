declare module "micromatch" {
  export interface MicromatchOptions {
    dot?: boolean;
  }

  export function matcher(pattern: string | string[], options?: MicromatchOptions): (value: string) => boolean;

  export function isMatch(value: string, pattern: string | string[], options?: MicromatchOptions): boolean;

  interface MicromatchExport {
    (list: string[], pattern: string | string[], options?: MicromatchOptions): string[];
    matcher: typeof matcher;
    isMatch: typeof isMatch;
  }

  const micromatch: MicromatchExport;
  export default micromatch;
}
