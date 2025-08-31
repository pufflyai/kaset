import { vi } from "vitest";
import type { RemoteProvider, RemoteObject } from "../types";

export class MockRemoteProvider implements RemoteProvider {
  private files = new Map<string, { data: Blob; mtimeMs: number; size: number; sha256?: string }>();

  // Spy methods for testing
  public listSpy = vi.fn();
  public uploadSpy = vi.fn();
  public downloadSpy = vi.fn();
  public removeSpy = vi.fn();
  public updateAuthSpy = vi.fn();

  constructor(initialFiles: Record<string, { content: string; mtimeMs?: number; sha256?: string }> = {}) {
    Object.entries(initialFiles).forEach(([key, { content, mtimeMs = Date.now(), sha256 }]) => {
      const blob = new Blob([content], { type: "text/plain" });
      this.files.set(key, { data: blob, mtimeMs, size: blob.size, sha256 });
    });
  }

  async list(prefix: string = ""): Promise<RemoteObject[]> {
    this.listSpy(prefix);
    const result: RemoteObject[] = [];

    for (const [key, file] of this.files.entries()) {
      if (key.startsWith(prefix)) {
        result.push({
          key,
          size: file.size,
          mtimeMs: file.mtimeMs,
          sha256: file.sha256,
        });
      }
    }

    return result;
  }

  async upload(key: string, data: Blob | ReadableStream): Promise<void> {
    this.uploadSpy(key, data);
    const blob = data instanceof Blob ? data : new Blob([await new Response(data).arrayBuffer()]);
    this.files.set(key, {
      data: blob,
      mtimeMs: Date.now(),
      size: blob.size,
    });
  }

  async download(key: string): Promise<Blob> {
    this.downloadSpy(key);
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`File not found: ${key}`);
    }
    return file.data;
  }

  async remove(key: string): Promise<void> {
    this.removeSpy(key);
    this.files.delete(key);
  }

  updateAuth(token?: string): void {
    this.updateAuthSpy(token);
  }

  // Test utilities
  setFile(key: string, content: string, mtimeMs: number = Date.now(), sha256?: string): void {
    const blob = new Blob([content], { type: "text/plain" });
    this.files.set(key, { data: blob, mtimeMs, size: blob.size, sha256 });
  }

  hasFile(key: string): boolean {
    return this.files.has(key);
  }

  getFileContent(key: string): string | undefined {
    const file = this.files.get(key);
    if (!file) return undefined;
    // For testing purposes, we'll return a placeholder since we can't easily read blob content
    return `[Blob size: ${file.size}]`;
  }

  clear(): void {
    this.files.clear();
  }
}
