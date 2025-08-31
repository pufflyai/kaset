import type { OpfsSyncOptions, ProgressEventDetail, RemoteProvider } from "./types";

/**
 * Orchestrates syncing between a local OPFS directory and a remote provider.
 */
export class OpfsSync extends EventTarget {
  private localDir: FileSystemDirectoryHandle;
  public remote: RemoteProvider;
  private scanInterval: number;
  private timer?: number;

  constructor(options: OpfsSyncOptions) {
    super();
    this.localDir = options.localDir;
    this.remote = options.remote;
    this.scanInterval = options.scanInterval ?? 0;
  }

  /**
   * Perform a full diff between the local directory and the remote and
   * reconcile differences using a last-writer-wins policy based on mtime.
   */
  async initialSync(): Promise<void> {
    const local = await this.scanLocal();
    const remoteList = await this.remote.list("");
    const remote = new Map(remoteList.map((o) => [o.key, o]));

    const paths = new Set<string>([...local.keys(), ...remote.keys()]);
    for (const path of paths) {
      const l = local.get(path);
      const r = remote.get(path);
      if (l && !r) {
        await this.uploadFile(path);
      } else if (!l && r) {
        await this.downloadFile(path);
      } else if (l && r) {
        if (r.sha256 && l.sha === r.sha256) continue;
        if (l.mtimeMs >= r.mtimeMs) {
          await this.uploadFile(path);
        } else {
          await this.downloadFile(path);
        }
      }
    }
  }

  /** Start periodic scanning. */
  startWatching(): void {
    if (this.scanInterval > 0 && !this.timer) {
      this.timer = setInterval(() => {
        this.initialSync().catch((err) => this.dispatchError(err));
      }, this.scanInterval) as unknown as number;
    }
  }

  /** Stop periodic scanning. */
  stopWatching(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private dispatchProgress(detail: ProgressEventDetail): void {
    this.dispatchEvent(new CustomEvent("progress", { detail }));
  }

  private dispatchError(error: unknown): void {
    this.dispatchEvent(new CustomEvent("error", { detail: error }));
  }

  private async uploadFile(path: string): Promise<void> {
    try {
      const handle = await this.getFileHandle(path);
      const file = await handle.getFile();
      this.dispatchProgress({
        phase: "upload",
        key: path,
        transferred: 0,
        total: file.size,
      });
      await this.remote.upload(path, file);
      this.dispatchProgress({
        phase: "upload",
        key: path,
        transferred: file.size,
        total: file.size,
      });
    } catch (e) {
      this.dispatchError(e);
    }
  }

  private async downloadFile(path: string): Promise<void> {
    try {
      const blob = await this.remote.download(path);
      this.dispatchProgress({
        phase: "download",
        key: path,
        transferred: 0,
        total: blob.size,
      });
      await this.writeFile(path, blob);
      this.dispatchProgress({
        phase: "download",
        key: path,
        transferred: blob.size,
        total: blob.size,
      });
    } catch (e) {
      this.dispatchError(e);
    }
  }

  private async scanLocal(): Promise<Map<string, { sha: string; mtimeMs: number; size: number }>> {
    const map = new Map<string, { sha: string; mtimeMs: number; size: number }>();
    await this.walkDir(this.localDir, "", map);
    return map;
  }

  private async walkDir(
    dir: FileSystemDirectoryHandle,
    prefix: string,
    map: Map<string, { sha: string; mtimeMs: number; size: number }>,
  ): Promise<void> {
    for await (const entry of (dir as any).values()) {
      const path = `${prefix}${entry.name}`;
      if (entry.kind === "directory") {
        await this.walkDir(entry, `${path}/`, map);
      } else {
        const file = await entry.getFile();
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        map.set(path, {
          sha,
          mtimeMs: file.lastModified,
          size: file.size,
        });
      }
    }
  }

  private async getFileHandle(path: string): Promise<FileSystemFileHandle> {
    const parts = path.split("/");
    let dir = this.localDir;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    return dir.getFileHandle(parts[parts.length - 1], { create: true });
  }

  private async writeFile(path: string, data: Blob): Promise<void> {
    const handle = await this.getFileHandle(path);
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  }
}
