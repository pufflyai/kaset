import type { McpServerConfig } from "@/state/types";

export const DEFAULT_MCP_SERVER_URL = "https://mcp.context7.com/mcp";

export const DEFAULT_MCP_SERVER: McpServerConfig = {
  id: "context7",
  name: "Context7 Demo",
  url: DEFAULT_MCP_SERVER_URL,
};
