import { patch as applyPatchInOPFS, hasParentTraversal, joinUnderWorkspace } from "@pstdio/opfs-utils";
import { OPFSToolRunner } from "../types";

export type OpfsPatchParams = {
  diff: string;
  cwd?: string;
};

type PatchResult = Awaited<ReturnType<typeof applyPatchInOPFS>>;

export type OpfsPatchResult = PatchResult & {
  cwd: string;
};

export const opfs_patch: OPFSToolRunner<OpfsPatchParams, OpfsPatchResult> = (options) => async (params, config) => {
  if (hasParentTraversal(params?.cwd)) throw new Error("Path escapes workspace: invalid cwd");

  return (async () => {
    const gate = options.approvalGate;

    await gate?.check("opfs_patch", options.rootDir, { summary: params.diff.slice(0, 200) });

    const cwd = joinUnderWorkspace(options.rootDir, params?.cwd || "");
    const payload = await applyPatchInOPFS({ workDir: cwd, diffContent: params.diff });

    return {
      messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify(payload) }],
    };
  })();
};

export const opfs_patch_definition = {
  name: "opfs_patch",
  description:
    "Applies a unified diff patch to the workspace, modifying files based on standard diff syntax. Supports file creation, deletion, and renaming operations.",
  parameters: {
    type: "object",
    properties: {
      diff: {
        type: "string",
        description:
          "A unified diff string describing the changes to apply. Must strictly follow the standard format with `---` and `+++` file headers and `@@` hunk markers. Only include the raw diff—no extra commentary or wrapper text. Supports additions (with `/dev/null` as the source), deletions, and renames using `a/` and `b/` prefixes.",
      },
    },
    required: ["diff"],
  },
};
