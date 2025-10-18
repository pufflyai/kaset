import { grep, hasParentTraversal, joinUnderWorkspace } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsGrepParams = {
  path?: string;
  pattern: string;
  flags?: string;
  include?: string[];
  exclude?: string[];
  maxFileSizeBytes?: number;
};

type GrepMatches = Awaited<ReturnType<typeof grep>>;

export type OpfsGrepResult = {
  count: number;
  matches: GrepMatches;
};

export const opfs_grep: OPFSToolRunner<OpfsGrepParams, OpfsGrepResult> = (options) => async (params, config) => {
  if (hasParentTraversal(params?.path)) throw new Error("Path escapes workspace: invalid path");

  return (async () => {
    const effectivePath = joinUnderWorkspace(options.rootDir, params?.path || "");
    const matches = await grep(effectivePath, {
      pattern: params.pattern,
      flags: params.flags,
      include: params.include,
      exclude: params.exclude,
      maxFileSize: params.maxFileSizeBytes ?? 20 * 1024 * 1024,
    });

    const payload = { count: matches.length, matches };

    return {
      messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
    };
  })();
};

export const opfs_grep_definition = {
  name: "opfs_grep",
  description:
    "Performs a recursive regular expression search across files under a given workspace path. Supports standard JavaScript RegExp syntax (without inline PCRE flags). Use the 'flags' parameter for modifiers such as 'i' for case-insensitive matching.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        default: "",
        description:
          "The starting directory path, relative to the workspace root. Defaults to the root if not specified.",
      },
      pattern: {
        type: "string",
        description: "The regular expression pattern to search for.",
      },
      flags: {
        type: "string",
        description: "JavaScript RegExp flags (e.g., 'i' for case-insensitive, 'm' for multiline).",
      },
      include: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of glob-style patterns to include in the search (e.g., ['*.js', '*.ts']).",
      },
      exclude: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of glob-style patterns to exclude from the search.",
      },
      maxFileSizeBytes: {
        type: "number",
        description: "Maximum file size (in bytes) to include in the search. Larger files are skipped.",
      },
    },
    required: ["pattern"],
  },
};
