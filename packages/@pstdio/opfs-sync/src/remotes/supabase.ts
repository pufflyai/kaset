import type { SupabaseClient } from "@supabase/supabase-js";
import type { RemoteObject, RemoteProvider } from "../types";

/**
 * Supabase implementation of the RemoteProvider interface.
 */
export class SupabaseRemote implements RemoteProvider {
  private client: SupabaseClient;
  private bucket: string;
  private prefix: string;

  constructor(client: SupabaseClient, bucket: string, prefix: string = "") {
    this.client = client;
    this.bucket = bucket;
    this.prefix = prefix;
  }

  private fullPath(key: string): string {
    return `${this.prefix}${key}`.replace(/^\/+/, "");
  }

  async list(prefix: string = ""): Promise<RemoteObject[]> {
    const base = this.fullPath(prefix);
    const files: RemoteObject[] = [];
    const stack: string[] = [base];

    while (stack.length) {
      const path = stack.pop()!;
      const { data, error } = await this.client.storage.from(this.bucket).list(path, { limit: 1000, offset: 0 });
      if (error) throw error;
      for (const item of data) {
        const isFile = (item as any).metadata !== undefined;
        if (!isFile) {
          stack.push(`${path}${item.name}/`);
        } else {
          const key = `${path}${item.name}`.slice(this.prefix.length);
          files.push({
            key,
            size: ((item as any).metadata?.size as number) ?? 0,
            mtimeMs: item.updated_at ? Date.parse(item.updated_at) : Date.now(),
          });
        }
      }
    }

    return files;
  }

  async upload(key: string, data: Blob | ReadableStream): Promise<void> {
    const path = this.fullPath(key);
    const fileData = data instanceof Blob ? data : new Blob([await new Response(data).arrayBuffer()]);
    const { error } = await this.client.storage.from(this.bucket).upload(path, fileData, { upsert: true });
    if (error) throw error;
  }

  async download(key: string): Promise<Blob> {
    const path = this.fullPath(key);
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error || !data) throw error;
    return data as Blob;
  }

  async remove(key: string): Promise<void> {
    const path = this.fullPath(key);
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) throw error;
  }

  updateAuth(token?: string): void {
    // best-effort helper for rotating JWTs
    try {
      this.client.auth.setSession(
        token ? { access_token: token, refresh_token: token } : { access_token: "", refresh_token: "" },
      );
    } catch {
      /* ignore */
    }
  }
}
