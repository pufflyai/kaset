import { hasParentTraversal, joinUnderWorkspace, moveFile as moveFileAtRoot } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsMoveFileParams = {
  from: string;
  to: string;
};

export type OpfsMoveFileResult = {
  ok: boolean;
  from: string;
  to: string;
};

export const opfs_move_file: OPFSToolRunner<OpfsMoveFileParams, OpfsMoveFileResult> =
  (options) => async (params, config) => {
    if (hasParentTraversal(params?.from)) throw new Error("Path escapes workspace: invalid from");
    if (hasParentTraversal(params?.to)) throw new Error("Path escapes workspace: invalid to");

    return (async () => {
      const gate = options.approvalGate;

      await gate?.check("opfs_move_file", options.rootDir, { from: params.from, to: params.to });

      const fullFrom = joinUnderWorkspace(options.rootDir, params.from);
      const fullTo = joinUnderWorkspace(options.rootDir, params.to);

      await moveFileAtRoot(fullFrom, fullTo);

      const payload = { ok: true, from: fullFrom, to: fullTo };

      return {
        messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    })();
  };

export const opfs_move_file_definition = {
  name: "opfs_move_file",
  description: "Moves or renames a file within the workspace.",
  parameters: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "The current path of the file, relative to the workspace root.",
      },
      to: {
        type: "string",
        description: "The new path or filename for the file, relative to the workspace root.",
      },
    },
    required: ["from", "to"],
  },
};
