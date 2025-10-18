declare module "@pstdio/opfs-utils" {
  export interface ChangeRecord {
    kind: "create" | "modify" | "delete";
    path: string[];
  }

  export interface ScopedFs {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, contents: Uint8Array | string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    moveFile(from: string, to: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdirp(path: string): Promise<void>;
    readJSON<T = unknown>(path: string): Promise<T>;
    writeJSON(path: string, value: unknown, pretty?: boolean): Promise<void>;
  }

  export interface LsEntry {
    path: string;
    name: string;
    kind: "file" | "directory";
    depth: number;
  }

  export interface LsOptions {
    maxDepth?: number;
    kinds?: Array<"file" | "directory">;
    showHidden?: boolean;
  }

  export function createScopedFs(root: string): ScopedFs;
  export function ls(path: string, options?: LsOptions): Promise<LsEntry[]>;

  export type DirectoryWatcherCleanup = () => void | Promise<void>;
  export interface WatchDirectoryOptions {
    recursive?: boolean;
    emitInitial?: boolean;
  }

  export function watchDirectory(
    path: string,
    callback: (changes: ChangeRecord[]) => void,
    options?: WatchDirectoryOptions,
  ): Promise<DirectoryWatcherCleanup>;
}
