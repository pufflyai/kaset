import { hasParentTraversal, joinUnderWorkspace, writeFile as writeFileAtRoot } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsWriteFileParams = {
  file: string;
  content: string;
};

export type OpfsWriteFileResult = {
  ok: boolean;
  file: string;
};

export const opfs_write_file: OPFSToolRunner<OpfsWriteFileParams, OpfsWriteFileResult> =
  (options) => async (params, config) => {
    if (hasParentTraversal(params?.file)) throw new Error("Path escapes workspace: invalid file");

    return (async () => {
      const gate = options.approvalGate;

      await gate?.check("opfs_write_file", options.rootDir, { file: params.file });

      const full = joinUnderWorkspace(options.rootDir, params.file);

      await writeFileAtRoot(full, params.content);

      const payload = { ok: true, file: full };

      return {
        messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    })();
  };

export const opfs_write_file_definition = {
  name: "opfs_write_file",
  description: "Creates or overwrites a text file in the workspace with the specified content.",
  parameters: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description:
          "Path to the file to write, relative to the workspace root. If the file does not exist, it will be created.",
      },
      content: {
        type: "string",
        description: "The text content to write into the file.",
      },
    },
    required: ["file", "content"],
  },
};
