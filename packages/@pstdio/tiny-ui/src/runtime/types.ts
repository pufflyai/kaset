export interface WorkspaceFs {
  readFile(path: string): Promise<Uint8Array>;
}

export interface TinyFsEntry {
  /** Path relative to the plugin's data root */
  path: string;
  /** Basename for quick display */
  name: string;
  /** File type */
  kind: "file" | "directory";
  /** Depth relative to the requested directory (1 = direct child) */
  depth: number;
  /** Optional metadata for polling */
  size?: number;
  lastModified?: number;
}

export interface TinyFsDirSnapshot {
  /** Directory that was inspected, relative to the data root */
  dir: string;
  entries: TinyFsEntry[];
  /** Stable signature derived from entries for change detection */
  signature: string;
  /** Epoch ms when the snapshot was generated */
  generatedAt: number;
}

export interface TinyUiOpsRequest {
  method: string;
  params?: Record<string, unknown>;
}

export type TinyUiOpsHandler = (request: TinyUiOpsRequest) => Promise<unknown>;
