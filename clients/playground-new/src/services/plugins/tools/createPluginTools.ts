import { Tool } from "@pstdio/tiny-ai-tasks";

import type { PluginStatusSnapshot, PluginVerificationOptions, PluginVerificationResult } from "../plugin-host";

interface PluginToolDependencies {
  getStatus(pluginId: string): PluginStatusSnapshot | undefined;
  listCommands(pluginId: string): string[];
  verify(pluginId: string, options?: PluginVerificationOptions): Promise<PluginVerificationResult>;
}

interface PluginStatusParams {
  pluginId: string;
}

interface PluginStatusResult {
  pluginId: string;
  status: PluginStatusSnapshot | null;
  commands: string[];
}

interface VerifyPluginParams extends PluginVerificationOptions {
  pluginId: string;
}

export function createPluginTools(dependencies: PluginToolDependencies): Tool[] {
  const { getStatus, listCommands, verify } = dependencies;

  const statusTool = Tool<PluginStatusParams, PluginStatusResult>(
    async ({ pluginId }) => {
      if (!pluginId || typeof pluginId !== "string") {
        throw new Error("pluginId must be a non-empty string");
      }

      const status = getStatus(pluginId);
      const commands = listCommands(pluginId);

      return {
        pluginId,
        status: status ?? null,
        commands,
      };
    },
    {
      name: "plugin_status",
      description:
        "Inspect the specified plugin, returning the latest reload timestamp, recent notifications, and registered command ids.",
      parameters: {
        type: "object",
        properties: {
          pluginId: {
            type: "string",
            description: "Identifier of the plugin to inspect.",
          },
        },
        required: ["pluginId"],
      },
    },
  );

  const verifyTool = Tool<VerifyPluginParams, PluginVerificationResult>(
    async ({ pluginId, ...options }) => {
      if (!pluginId || typeof pluginId !== "string") {
        throw new Error("pluginId must be a non-empty string");
      }

      return verify(pluginId, options);
    },
    {
      name: "verify_plugin_update",
      description: "Verify that the given plugin reloaded successfully and optionally run its self-test command.",
      parameters: {
        type: "object",
        properties: {
          pluginId: {
            type: "string",
            description: "Identifier of the plugin to verify.",
          },
          waitForReload: {
            type: "boolean",
            description: "Whether to wait for the next reload event before performing verification. Defaults to true.",
          },
          reloadTimeoutMs: {
            type: "number",
            description: "Maximum time in milliseconds to wait for a reload before failing.",
          },
          afterReloadAt: {
            type: "number",
            description: "Only treat reloads newer than this timestamp (milliseconds since epoch) as valid.",
          },
          selftestCommandId: {
            type: "string",
            description: "Override the command id used for self-testing. Defaults to 'selftest' when available.",
          },
        },
        required: ["pluginId"],
      },
    },
  );

  return [statusTool as Tool, verifyTool as Tool];
}
