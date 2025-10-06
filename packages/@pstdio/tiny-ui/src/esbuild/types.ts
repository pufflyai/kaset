export interface CompileResult {
  id: string;
  hash: string;
  url: `/virtual/${string}.js`;
  fromCache: boolean;
  bytes: number;
  assets: string[];
}

export interface BuildWithEsbuildOptions {
  wasmURL: string;
  define?: Record<string, string>;
}

export interface SnapshotFileMap {
  [path: string]: string;
}

export interface BuildMetadata {
  bytes: number;
  assets: string[];
}
