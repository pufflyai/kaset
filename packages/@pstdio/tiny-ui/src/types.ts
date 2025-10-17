export interface TinyUiOpsRequest {
  method: string;
  params?: Record<string, unknown>;
}

export type TinyUiOpsHandler = (request: TinyUiOpsRequest) => Promise<unknown>;

export type TinyUIStatus = "idle" | "initializing" | "compiling" | "ready" | "error";
