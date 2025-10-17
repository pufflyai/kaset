export interface CompileResult {
  id: string;
  hash: string;
  url: string;
  fromCache: boolean;
  bytes: number;
  assets: string[];
  lockfileHash: string;
}

export interface BuildWithEsbuildOptions {
  wasmURL: string;
  define?: Record<string, string>;
  skipCache?: boolean;
}

export interface SnapshotFileMap {
  [path: string]: string;
}
