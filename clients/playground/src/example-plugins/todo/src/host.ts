export type FsScope = "plugin" | "data" | "workspace";

export interface TinyUiHost {
  call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
}
