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

declare module "@pstdio/tiny-ai-tasks" {
  export interface ToolDefinition {
    name: string;
    description?: string;
    parameters?: unknown;
  }

  export interface ToolConfig {
    toolCall?: { id?: string; function: { name: string; arguments: string } };
  }

  export interface Tool<TParams = unknown, TResult = unknown> {
    definition: ToolDefinition;
    run: (params: TParams, config: ToolConfig) => Promise<TResult>;
  }
}
