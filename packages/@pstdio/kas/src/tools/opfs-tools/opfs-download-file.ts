import { downloadFile as downloadFileAtRoot, hasParentTraversal, joinUnderWorkspace } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsDownloadFileParams = {
  file: string;
};

export type OpfsDownloadFileResult = {
  ok: boolean;
  file: string;
};

export const opfs_download_file: OPFSToolRunner<OpfsDownloadFileParams, OpfsDownloadFileResult> =
  (options) => async (params, config) => {
    if (hasParentTraversal(params?.file)) throw new Error("Path escapes workspace: invalid file");

    return (async () => {
      const full = joinUnderWorkspace(options.rootDir, params.file);

      await downloadFileAtRoot(full);

      const payload = { ok: true, file: full };

      return {
        messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    })();
  };

export const opfs_download_file_definition = {
  name: "opfs_download",
  description:
    "Initiates a browser download of a specified workspace file. Useful for exporting text, media, or other file types directly to the user’s local machine.",
  parameters: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "Path to the file to download, relative to the workspace root.",
      },
    },
    required: ["file"],
  },
};
