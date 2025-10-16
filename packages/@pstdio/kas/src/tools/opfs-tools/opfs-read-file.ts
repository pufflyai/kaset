import { hasParentTraversal, joinUnderWorkspace, processSingleFileContent } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsReadFileParams = {
  file: string;
  offset?: number;
  limit?: number;
};

type ReadFileResult = Awaited<ReturnType<typeof processSingleFileContent>>;

export type OpfsReadFilePayload = ReadFileResult & {
  file: string;
};

export const opfs_read_file: OPFSToolRunner<OpfsReadFileParams, OpfsReadFilePayload> =
  (options) => async (params, config) => {
    if (hasParentTraversal(params?.file)) throw new Error("Path escapes workspace: invalid file");

    return (async () => {
      const full = joinUnderWorkspace(options.rootDir, params.file);
      const result = await processSingleFileContent(full, options.rootDir, undefined, params.offset, params.limit);
      const payload = { ...result, file: full };

      return {
        messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    })();
  };

export const opfs_read_file_definition = {
  name: "opfs_read_file",
  description:
    "Reads the contents of a workspace file. Supports text, media, and PDF files, with optional parameters to read only a specific byte or line range.",
  parameters: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "Path to the file to read, relative to the workspace root.",
      },
      offset: {
        type: "number",
        description: "Optional byte offset to start reading from. Useful for partial or paginated reads.",
      },
      limit: {
        type: "number",
        description: "Optional maximum number of bytes or lines to read, depending on the file type.",
      },
    },
    required: ["file"],
  },
};
