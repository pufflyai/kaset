import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MCP_SERVER, DEFAULT_MCP_SERVER_URL } from "./constants";

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

export type McpClientStatus = UseMcpClientState["status"];

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
  const parameters = tool.inputSchema;

  return {
    definition: {
      name: tool.name,
      description: tool.description || undefined,
      parameters,
    },
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

type ClientEntry = {
  client: Client;
  url: string;
  token?: string;
};

type ConnectionState = {
  status: McpClientStatus;
  error: unknown;
  tools: Tool[];
  loading: boolean;
};

export interface UseMcpServiceResult {
  clients: Record<string, Client>;
  tools: Tool[];
  toolsByServer: Record<string, Tool[]>;
  statuses: Record<string, McpClientStatus>;
  errors: Record<string, unknown>;
  loading: boolean;
}

export function useMcpService(): UseMcpServiceResult {
  const servers = useWorkspaceStore((state) => state.mcpServers);
  const activeIds = useWorkspaceStore((state) => state.activeMcpServerIds);
  const legacySelectedId = useWorkspaceStore((state) => {
    const record = state as unknown as Record<string, unknown>;
    const value = record["selectedMcpServerId"];
    return typeof value === "string" ? value : undefined;
  });

  const clientsRef = useRef<Record<string, ClientEntry>>({});
  const pendingRef = useRef<Record<string, string>>({});
  const [connectionState, setConnectionState] = useState<Record<string, ConnectionState>>({});

  const normalizedServers = useMemo(() => {
    if (!servers) return [DEFAULT_MCP_SERVER];
    return servers;
  }, [servers]);

  const activeServers = useMemo(() => {
    if (Array.isArray(activeIds)) {
      if (activeIds.length === 0) return [];
      const idSet = new Set(activeIds);
      return normalizedServers.filter((server) => idSet.has(server.id));
    }

    if (legacySelectedId) {
      const match = normalizedServers.find((server) => server.id === legacySelectedId);
      if (match) return [match];
    }

    if (!activeIds && normalizedServers.length > 0) {
      return [normalizedServers[0]];
    }

    return [];
  }, [activeIds, legacySelectedId, normalizedServers]);

  useEffect(() => {
    let cancelled = false;

    const activeIdSet = new Set(activeServers.map((server) => server.id));

    const closeClient = (id: string, entry?: ClientEntry) => {
      const target = entry ?? clientsRef.current[id];
      if (!target) return;

      void target.client.close().catch(() => undefined);
      if (target.url) {
        void fetch(target.url, { method: "DELETE" }).catch(() => undefined);
      }

      delete clientsRef.current[id];
    };

    Object.entries(clientsRef.current).forEach(([id, entry]) => {
      if (!activeIdSet.has(id)) {
        closeClient(id, entry);
      }
    });

    Object.keys(pendingRef.current).forEach((id) => {
      if (!activeIdSet.has(id)) {
        delete pendingRef.current[id];
      }
    });

    setConnectionState((prev) => {
      const next: Record<string, ConnectionState> = {};

      activeServers.forEach((server) => {
        const hasUrl = Boolean(server.url?.trim());
        const existing = prev[server.id];

        if (!hasUrl) {
          next[server.id] = { status: "idle", error: null, tools: [], loading: false };
          return;
        }

        next[server.id] = existing ? { ...existing } : { status: "idle", error: null, tools: [], loading: false };
      });

      return next;
    });

    activeServers.forEach((server) => {
      const url = server.url?.trim();
      const token = server.accessToken?.trim() || undefined;

      if (!url) {
        closeClient(server.id);
        return;
      }

      const signature = `${server.id}:${url}:${token ?? ""}`;
      const existingEntry = clientsRef.current[server.id];

      if (existingEntry && existingEntry.url === url && existingEntry.token === token) {
        setConnectionState((prev) => {
          const current = prev[server.id];
          if (!current || current.status === "ready") return prev;
          return {
            ...prev,
            [server.id]: { ...current, status: "ready", error: null },
          };
        });
        return;
      }

      if (existingEntry) {
        closeClient(server.id, existingEntry);
      }

      pendingRef.current[server.id] = signature;

      setConnectionState((prev) => ({
        ...prev,
        [server.id]: { status: "connecting", error: null, tools: [], loading: true },
      }));

      (async () => {
        let client: Client | null = null;
        try {
          client = new Client({
            name: "kaset-playground",
            version: "0.1.0",
            title: "Kaset Playground MCP",
          });

          const headers: HeadersInit | undefined = token
            ? {
                Authorization: `Bearer ${encodeURIComponent(token)}`,
              }
            : undefined;

          const transport = new StreamableHTTPClientTransport(
            new URL(url),
            headers ? { requestInit: { headers } } : undefined,
          );

          await client.connect(transport);

          if (cancelled || pendingRef.current[server.id] !== signature) {
            await client.close().catch(() => undefined);
            return;
          }

          clientsRef.current[server.id] = { client, url, token };

          setConnectionState((prev) => ({
            ...prev,
            [server.id]: {
              status: "ready",
              error: null,
              tools: prev[server.id]?.tools ?? [],
              loading: true,
            },
          }));

          const response = await client.listTools();
          if (cancelled || pendingRef.current[server.id] !== signature) {
            return;
          }

          const mapped = response.tools.map((tool) => createMcpTool(client!, tool as RemoteTool));

          setConnectionState((prev) => ({
            ...prev,
            [server.id]: { status: "ready", error: null, tools: mapped, loading: false },
          }));
        } catch (error) {
          if (cancelled || pendingRef.current[server.id] !== signature) {
            return;
          }

          if (clientsRef.current[server.id]) {
            closeClient(server.id);
          } else if (client) {
            void client.close().catch(() => undefined);
            void fetch(url, { method: "DELETE" }).catch(() => undefined);
          }

          setConnectionState((prev) => ({
            ...prev,
            [server.id]: { status: "error", error, tools: [], loading: false },
          }));
        } finally {
          if (!cancelled && pendingRef.current[server.id] === signature) {
            delete pendingRef.current[server.id];
          }
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [activeServers]);

  useEffect(() => {
    return () => {
      Object.entries(clientsRef.current).forEach(([id, entry]) => {
        void entry.client.close().catch(() => undefined);
        if (entry.url) {
          void fetch(entry.url, { method: "DELETE" }).catch(() => undefined);
        }
        delete clientsRef.current[id];
      });
      pendingRef.current = {};
    };
  }, []);

  const toolsByServer = useMemo(() => {
    const entries = Object.entries(connectionState).map(([id, state]) => [id, state.tools]);
    return Object.fromEntries(entries);
  }, [connectionState]);

  const tools = useMemo(() => Object.values(connectionState).flatMap((state) => state.tools), [connectionState]);

  const statuses = useMemo(() => {
    const map: Record<string, McpClientStatus> = {};
    Object.entries(connectionState).forEach(([id, state]) => {
      map[id] = state.status;
    });
    return map;
  }, [connectionState]);

  const errors = useMemo(() => {
    const map: Record<string, unknown> = {};
    Object.entries(connectionState).forEach(([id, state]) => {
      if (state.error != null) {
        map[id] = state.error;
      }
    });
    return map;
  }, [connectionState]);

  const loading = useMemo(
    () => Object.values(connectionState).some((state) => state.loading || state.status === "connecting"),
    [connectionState],
  );

  const clients = useMemo(() => {
    const map: Record<string, Client> = {};
    Object.entries(clientsRef.current).forEach(([id, entry]) => {
      map[id] = entry.client;
    });
    return map;
  }, [connectionState]);

  return {
    clients,
    tools,
    toolsByServer,
    statuses,
    errors,
    loading,
  };
}
