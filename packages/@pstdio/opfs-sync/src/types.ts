export interface RemoteObject {
  key: string;
  size: number;
  mtimeMs: number;
  sha256?: string;
}

export interface RemoteProvider {
  list(prefix: string): Promise<RemoteObject[]>;
  upload(key: string, data: Blob | ReadableStream): Promise<void>;
  download(key: string): Promise<Blob>;
  remove(key: string): Promise<void>;
  updateAuth?(token?: string): void;
}

export interface OpfsSyncOptions {
  localDir: FileSystemDirectoryHandle;
  remote: RemoteProvider;
  scanInterval?: number;
  encryptionKey?: Uint8Array;
}

export type ProgressPhase = "upload" | "download";

export interface ProgressEventDetail {
  phase: ProgressPhase;
  key: string;
  transferred: number;
  total: number;
}
