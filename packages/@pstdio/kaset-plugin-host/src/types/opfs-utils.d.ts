declare module "@pstdio/opfs-utils" {
  export interface LsEntry {
    path: string;
    name: string;
    kind: "file" | "directory";
    depth: number;
    size?: number;
    lastModified?: number;
    type?: string;
  }

  export interface LsOptions {
    maxDepth?: number;
    include?: string[];
    exclude?: string[];
    showHidden?: boolean;
    kinds?: Array<"file" | "directory">;
    stat?: boolean;
    concurrency?: number;
    signal?: AbortSignal;
    onEntry?: (entry: LsEntry) => void | Promise<void>;
    sortBy?: "name" | "path" | "size" | "mtime";
    sortOrder?: "asc" | "desc";
    dirsFirst?: boolean;
  }

  export type ChangeType = "appeared" | "modified" | "disappeared" | "moved" | "unknown" | "errored";

  export interface ChangeRecord {
    type: ChangeType;
    path: string[];
    size?: number;
    lastModified?: number;
    handleKind?: FileSystemHandle["kind"];
  }

  export type DirectoryWatcherCleanup = () => void | Promise<void>;

  export interface WatchOptions {
    intervalMs?: number;
    pauseWhenHidden?: boolean;
    emitInitial?: boolean;
    recursive?: boolean;
    signal?: AbortSignal;
    ignore?: RegExp | RegExp[] | ((path: string[], handle: FileSystemHandle) => boolean);
  }

  export function ls(path: string, options?: LsOptions): Promise<LsEntry[]>;
  export function readFile(path: string): Promise<string>;
  export function writeFile(path: string, contents: string): Promise<void>;
  export function deleteFile(path: string): Promise<void>;
  export function moveFile(from: string, to: string): Promise<void>;

  export function watchDirectory(
    path: string,
    callback: (changes: ChangeRecord[]) => void | Promise<void>,
    options?: WatchOptions,
  ): Promise<DirectoryWatcherCleanup>;

  export function grep(
    directory: string,
    options: {
      pattern: RegExp | string;
      include?: string[];
      exclude?: string[];
      flags?: string;
    },
  ): Promise<Array<{ file: string; matches: Array<{ line: number; text: string }> }>>;

  export function patch(path: string, diff: string): Promise<void>;

  export interface ProcessSingleFileOptions {
    path: string;
    onText?: (text: string) => string | Promise<string>;
  }

  export interface ProcessedFileReadResult {
    path: string;
    content: string;
  }

  export function processSingleFileContent(
    options: ProcessSingleFileOptions,
  ): Promise<ProcessedFileReadResult>;
}
