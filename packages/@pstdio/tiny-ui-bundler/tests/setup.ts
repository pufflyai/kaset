import { webcrypto } from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";

if (typeof globalThis.crypto === "undefined") {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

if (typeof globalThis.TextEncoder === "undefined") {
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
}

if (typeof globalThis.TextDecoder === "undefined") {
  Object.defineProperty(globalThis, "TextDecoder", { value: TextDecoder, configurable: true });
}

class MemoryCache implements Cache {
  private readonly store = new Map<string, Response>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const key = this.keyFrom(request);
    const stored = this.store.get(key);
    return stored?.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const key = this.keyFrom(request);
    this.store.set(key, response.clone());
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    const key = this.keyFrom(request);
    return this.store.delete(key);
  }

  async keys(): Promise<Request[]> {
    return Array.from(this.store.keys()).map((url) => new Request(this.toAbsolute(url)));
  }

  private keyFrom(input: RequestInfo | URL): string {
    if (typeof input === "string") return this.normalize(input);
    if (input instanceof URL) return this.normalize(input.pathname);
    const url = this.toAbsolute(input.url ?? String(input));
    return this.normalize(new URL(url).pathname);
  }

  private normalize(path: string): string {
    if (!path.startsWith("http")) return path.startsWith("/") ? path : `/${path}`;
    return new URL(path).pathname;
  }

  private toAbsolute(path: string): string {
    if (path.startsWith("http")) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `https://kaset.virtual${normalized}`;
  }
}

class MemoryCaches implements CacheStorage {
  private readonly caches = new Map<string, MemoryCache>();

  async open(name: string): Promise<Cache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(name, cache);
    }
    return cache;
  }

  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys());
  }

  match(): Promise<Response | undefined> {
    return Promise.resolve(undefined);
  }
}

(globalThis as unknown as { caches: CacheStorage }).caches = new MemoryCaches();
