import { DEFAULT_MCP_SERVER } from "@/services/mcp/constants";
import { DEFAULT_APPROVAL_GATED_TOOLS } from "@pstdio/kas";
import type { WorkspaceState } from "./types";

export const DEFAULT_STATE: WorkspaceState = {
  version: "1.0",
  conversations: {
    default: {
      id: "default",
      name: "Conversation 1",
      messages: [],
      projectId: "todo",
    },
  },
  selectedProjectId: "todo",
  selectedConversationId: "default",
  selectedTab: "preview",
  modelId: "gpt-5",
  approvalGatedTools: [...DEFAULT_APPROVAL_GATED_TOOLS],
  mcpServers: [{ ...DEFAULT_MCP_SERVER }],
  activeMcpServerIds: [DEFAULT_MCP_SERVER.id],
};
