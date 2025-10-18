import { hasParentTraversal, joinUnderWorkspace, runOpfsCommandLine } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export interface OpfsShellParams {
  command: string;
  cwd?: string;
}

export interface OpfsShellResults {
  success: boolean;
  code: number;
}

export const opfs_shell: OPFSToolRunner<OpfsShellParams, OpfsShellResults> = (options) => async (params, config) => {
  if (hasParentTraversal(params.cwd)) throw new Error("Path escapes workspace: invalid cwd");

  return (async () => {
    const effectiveCwd = joinUnderWorkspace(options.rootDir, params.cwd || "");
    const res = await runOpfsCommandLine(params.command, { cwd: effectiveCwd });
    const payload = { success: res.code === 0, ...res, cwd: effectiveCwd };

    return {
      messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
    };
  })();
};

export const opfs_shell_definition = {
  name: "opfs_shell",
  description:
    "Executes read-only shell commands within the workspace, supporting utilities like `ls`, `sed`, and `rg`, as well as pipes and logical operators (`|`, `&&`).",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "The shell command to execute (e.g., 'rg TODO src | sed s/TODO/DONE/g'). Supports pipes and logical operators.",
      },
      cwd: {
        type: "string",
        default: "",
        description:
          "The working directory in which to run the command, relative to the workspace root. Defaults to the root directory.",
      },
    },
    required: ["command"],
  },
};
