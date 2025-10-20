import { Tool } from "@pstdio/tiny-ai-tasks";
import { ApprovalGate } from "../../approval";
import { verify_plugin_update, verify_plugin_update_definition } from "./verify_plugin_update";

export type CreatePluginToolsOptions = {
  rootDir: string;
  approvalGate: ApprovalGate;
};

export const createPluginTools = async (options: CreatePluginToolsOptions) => {
  const { rootDir, approvalGate } = options;

  const tools = [];

  tools.push(Tool(verify_plugin_update({ rootDir, approvalGate }), verify_plugin_update_definition));

  return tools;
};
