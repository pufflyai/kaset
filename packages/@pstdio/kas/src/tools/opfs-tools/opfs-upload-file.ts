import { hasParentTraversal, joinUnderWorkspace, uploadFilesToDirectory } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsUploadFilesParams = {
  destSubdir?: string;
  overwrite?: "replace" | "skip" | "rename";
  files: File[];
};

type UploadResult = Awaited<ReturnType<typeof uploadFilesToDirectory>>;

export const opfs_upload_files: OPFSToolRunner<OpfsUploadFilesParams, UploadResult> =
  (options) => async (params, config) => {
    if (hasParentTraversal(params?.destSubdir)) throw new Error("Path escapes workspace: invalid destSubdir");

    return (async () => {
      const gate = options.approvalGate;

      await gate?.check("opfs_upload_files", options.rootDir, {
        destSubdir: params?.destSubdir,
        count: params?.files?.length ?? 0,
      });

      const destPath = joinUnderWorkspace(options.rootDir, params?.destSubdir || "");

      const payload = await uploadFilesToDirectory(destPath, params.files, {
        overwrite: params?.overwrite,
      });

      return {
        messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    })();
  };

export const opfs_upload_files_definition = {
  name: "opfs_upload_files",
  description:
    "Uploads one or more files into the workspace. Supports specifying a target subdirectory and conflict-handling behavior (replace, skip, or rename).",
  parameters: {
    type: "object",
    properties: {
      destSubdir: {
        type: "string",
        default: "",
        description:
          "Target subdirectory within the workspace where the files will be uploaded. Defaults to the root directory.",
      },
      overwrite: {
        type: "string",
        enum: ["replace", "skip", "rename"],
        description:
          "Conflict resolution strategy: 'replace' overwrites existing files, 'skip' ignores them, and 'rename' preserves both by renaming the new files.",
      },
      files: {
        type: "array",
        items: { type: "object" },
        description:
          "List of files to upload. Each file object should include metadata such as name, type, and content.",
      },
    },
    required: ["files"],
  },
};
