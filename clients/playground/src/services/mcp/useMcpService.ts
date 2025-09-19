import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { useEffect, useMemo, useState } from "react";

type RemoteTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type CallToolResult = {
  content?: Array<{ type?: string; text?: string; [key: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
  message?: string;
  [key: string]: unknown;
};

export const DEFAULT_MCP_SERVER_URL = "https://mcp.context7.com/mcp";

export interface UseMcpClientOptions {
  /** Remote MCP endpoint. Defaults to the Context7 sample server. */
  serverUrl?: string;
  /** Optional bearer token passed in the `Authorization` header. */
  accessToken?: string | null;
  /** Toggle connection attempts. Defaults to true. */
  enabled?: boolean;
}

interface UseMcpClientState {
  client: Client | null;
  status: "idle" | "connecting" | "ready" | "error";
  error: unknown;
}

function extractMessage(result: CallToolResult): string | undefined {
  if (typeof result.message === "string" && result.message.trim()) return result.message.trim();

  if (Array.isArray(result.content)) {
    const text = result.content
      .map((entry) => {
        if (!entry) return "";
        if (typeof entry.text === "string" && entry.text.trim()) return entry.text.trim();
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (text) return text;
  }

  return undefined;
}

function normalizeResult(result: CallToolResult) {
  const message = extractMessage(result);

  return {
    success: !(result.isError ?? false),
    message,
    structuredContent: result.structuredContent,
    content: result.content,
  } as const;
}

function createMcpTool(client: Client, tool: RemoteTool): Tool {
  const parameters = tool.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type: "object" };

  return {
    definition: {
      name: tool.name,
      description: tool.description || undefined,
      parameters,
    },
    // NOTE: there is something wrong here, if _config is not present, the arguments are destructured in a wrong way
    // TODO: fix this in the SDK
    async run(callArguments, _config) {
      const result = (await client.callTool({
        name: tool.name,
        arguments: callArguments as Record<string, unknown>,
      })) as CallToolResult;

      return normalizeResult(result);
    },
  } satisfies Tool;
}

export function useMcpClient(options: UseMcpClientOptions = {}): UseMcpClientState {
  const { serverUrl = DEFAULT_MCP_SERVER_URL, accessToken, enabled = true } = options;

  const [state, setState] = useState<UseMcpClientState>({ client: null, status: "idle", error: null });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setState({ client: null, status: "idle", error: null });
      return;
    }

    let cancelled = false;

    async function connect() {
      setState({ client: null, status: "connecting", error: null });

      try {
        const url = new URL(serverUrl);
        const client = new Client({
          name: "kaset-playground",
          version: "0.1.0",
          title: "Kaset Playground MCP",
        });

        const headers: HeadersInit | undefined = accessToken
          ? {
              Authorization: `Bearer ${encodeURIComponent(accessToken)}`,
            }
          : undefined;

        const transport = new StreamableHTTPClientTransport(url, headers ? { requestInit: { headers } } : undefined);

        await client.connect(transport);

        if (cancelled) return;
        setState({ client, status: "ready", error: null });
      } catch (error) {
        if (cancelled) return;
        setState({ client: null, status: "error", error });
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (serverUrl) {
        fetch(serverUrl, { method: "DELETE" });
      }

      setState({ client: null, status: "idle", error: null });
    };
  }, [serverUrl, accessToken, enabled]);

  return state;
}

export type UseMcpServiceOptions = UseMcpClientOptions;

export interface UseMcpServiceResult {
  client: Client | null;
  tools: Tool[];
  status: UseMcpClientState["status"];
  loading: boolean;
  error: unknown;
}

export function useMcpService(options: UseMcpServiceOptions = {}): UseMcpServiceResult {
  const { client, status, error } = useMcpClient(options);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [toolsError, setToolsError] = useState<unknown>(null);

  useEffect(() => {
    if (!client) {
      setTools([]);
      setLoading(false);
      setToolsError(null);
      return;
    }

    let cancelled = false;
    const activeClient = client;

    async function loadTools() {
      setLoading(true);
      try {
        const response = await activeClient.listTools();
        if (cancelled) return;

        const mapped = response.tools.map((tool) => createMcpTool(activeClient, tool as RemoteTool));

        setTools(mapped);
        setToolsError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load MCP tools", err);
        setTools([]);
        setToolsError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTools();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const mergedError = useMemo(() => toolsError ?? error, [toolsError, error]);

  return {
    client,
    tools,
    status,
    loading,
    error: mergedError,
  };
}
