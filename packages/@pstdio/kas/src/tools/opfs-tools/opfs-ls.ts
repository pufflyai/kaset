import { hasParentTraversal, joinUnderWorkspace, ls } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsLsParams = {
  path?: string;
  maxDepth?: number;
  include?: string[];
  exclude?: string[];
  showHidden?: boolean;
  stat?: boolean;
};

export const opfs_ls: OPFSToolRunner<OpfsLsParams> = (options) => async (params, config) => {
  if (hasParentTraversal(params?.path)) throw new Error("Path escapes workspace: invalid path");

  return (async () => {
    const effectivePath = joinUnderWorkspace(options.rootDir, params?.path || "");
    const entries = await ls(effectivePath, {
      maxDepth: params?.maxDepth ?? 1,
      include: params?.include,
      exclude: params?.exclude,
      showHidden: params?.showHidden ?? false,
      stat: params?.stat ?? false,
      sortBy: "path",
      sortOrder: "asc",
      dirsFirst: true,
    });

    const payload = { entries };

    return {
      messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
    };
  })();
};

export const opfs_ls_definition = {
  name: "opfs_ls",
  description:
    "Lists files and directories under a specified workspace path. Can optionally include hidden files, recurse to a defined depth, and return file metadata.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        default: "",
        description: "Directory path to list, relative to the workspace root. Defaults to the root directory.",
      },
      maxDepth: {
        type: "number",
        default: 1,
        description: "How deep to recurse into subdirectories. A depth of 1 lists only the immediate contents.",
      },
      include: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of glob-style patterns to include (e.g., ['*.json']).",
      },
      exclude: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of glob-style patterns to exclude from the listing.",
      },
      showHidden: {
        type: "boolean",
        default: false,
        description: "Whether to include hidden files (those starting with a dot). Defaults to false.",
      },
      stat: {
        type: "boolean",
        default: false,
        description: "If true, includes detailed file statistics (e.g., size, modified time, type).",
      },
    },
  },
};
