import { deleteFile as deleteFileAtRoot, hasParentTraversal, joinUnderWorkspace } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsDeleteFileParams = {
  file: string;
};

export type OpfsDeleteFileResult = {
  ok: boolean;
  file: string;
};

export const opfs_delete_file: OPFSToolRunner<OpfsDeleteFileParams, OpfsDeleteFileResult> =
  (options) => async (params, config) => {
    if (hasParentTraversal(params?.file)) throw new Error("Path escapes workspace: invalid file");

    return (async () => {
      const approvalGate = options.approvalGate;
      if (!approvalGate?.check) throw new Error("Approval gate not configured for opfs_delete_file");

      await approvalGate.check("opfs_delete_file", options.rootDir, { file: params.file });

      const full = joinUnderWorkspace(options.rootDir, params.file);

      await deleteFileAtRoot(full);

      const payload = { ok: true, file: full };

      return {
        messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    })();
  };

export const opfs_delete_file_definition = {
  name: "opfs_delete_file",
  description: "Deletes a specified file from the workspace.",
  parameters: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "Path to the file to delete, relative to the workspace root.",
      },
    },
    required: ["file"],
  },
};
