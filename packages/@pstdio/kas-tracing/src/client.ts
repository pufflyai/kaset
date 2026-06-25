import { Client } from "langsmith";

const DEFAULT_ENDPOINT = "https://api.smith.langchain.com";
const DEFAULT_PROJECT = "kaset";

export interface ConfigureTracingOptions {
  enabled: boolean;
  apiKey?: string;
  project?: string;
  endpoint?: string;
  // Injection seam for tests; defaults to a real LangSmith client built from apiKey/endpoint.
  client?: Client;
}

interface TracingState {
  enabled: boolean;
  client?: Client;
  project: string;
}

let state: TracingState = { enabled: false, project: DEFAULT_PROJECT };

export function configureTracing(opts: ConfigureTracingOptions) {
  const client =
    opts.client ??
    (opts.apiKey
      ? new Client({
          apiKey: opts.apiKey,
          apiUrl: opts.endpoint ?? DEFAULT_ENDPOINT,
          // Post each run immediately instead of buffering into a batch that needs a flush.
          autoBatchTracing: false,
        })
      : undefined);

  // Tracing only turns on when explicitly enabled AND we have somewhere to send runs.
  const enabled = Boolean(opts.enabled && client);

  state = {
    enabled,
    client: enabled ? client : undefined,
    project: opts.project || DEFAULT_PROJECT,
  };
}

export function isTracingEnabled() {
  return state.enabled && !!state.client;
}

export function getClient() {
  return state.client;
}

export function getProject() {
  return state.project;
}
