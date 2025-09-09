import {
  patch as applyPatchInOPFS,
  deleteFile as deleteFileAtRoot,
  downloadFile as downloadFromRoot,
  getDirectoryHandle,
  getOPFSRoot,
  grep,
  hasParentTraversal,
  joinUnderWorkspace,
  ls,
  moveFile as moveFileAtRoot,
  processSingleFileContent,
  runOpfsCommandLine,
  uploadFilesToDirectory,
  writeFile as writeFileAtRoot,
} from "@pstdio/opfs-utils";
import { Tool } from "@pstdio/tiny-ai-tasks";
import { createApprovalGate, type Workspace } from "../approval";

type CreateToolsOptions = Workspace & {
  onShellChunk?: (chunk: string) => void;
  requestApproval?: (x: { tool: string; workspaceDir: string; detail?: any }) => Promise<boolean>;
};

export function createOpfsTools(opts: CreateToolsOptions) {
  const { workspaceDir, requestApproval, onShellChunk } = opts;
  const gate = createApprovalGate(requestApproval);

  const opfsShell = Tool(
    async ({ command, cwd = "" }: { command: string; cwd?: string }, { toolCall }) => {
      if (hasParentTraversal(cwd)) throw new Error("Path escapes workspace: invalid cwd");

      return (async () => {
        const root = await getOPFSRoot();
        const effectiveCwd = joinUnderWorkspace(workspaceDir, cwd || "");

        const res = await runOpfsCommandLine(command, {
          root,
          cwd: effectiveCwd,
          onChunk: (s) => onShellChunk?.(s),
        });

        const payload: any = { success: res.code === 0, ...res, cwd: effectiveCwd };

        return {
          messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
          data: payload,
        };
      })();
    },
    {
      name: "opfs_shell",
      description: "Run OPFS shell (ls/sed/rg with pipes/&&). Read/search only.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          cwd: { type: "string", default: "" },
        },
        required: ["command"],
      },
    },
  );

  const opfsLs = Tool(
    async (
      input: {
        path?: string;
        maxDepth?: number;
        include?: string[];
        exclude?: string[];
        showHidden?: boolean;
        stat?: boolean;
      },
      { toolCall },
    ) => {
      if (hasParentTraversal(input?.path)) throw new Error("Path escapes workspace: invalid path");

      const dir = await getDirectoryHandle(joinUnderWorkspace(workspaceDir, input?.path || ""));
      const entries = await ls(dir, {
        maxDepth: input?.maxDepth ?? 1,
        include: input?.include,
        exclude: input?.exclude,
        showHidden: input?.showHidden ?? false,
        stat: input?.stat ?? false,
        sortBy: "path",
        sortOrder: "asc",
        dirsFirst: true,
      });

      const payload = { entries } as const;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_ls",
      description: "List under a workspace-relative path.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", default: "" },
          maxDepth: { type: "number", default: 1 },
          include: { type: "array", items: { type: "string" } },
          exclude: { type: "array", items: { type: "string" } },
          showHidden: { type: "boolean", default: false },
          stat: { type: "boolean", default: false },
        },
      },
    },
  );

  const opfsGrep = Tool(
    async (
      input: {
        path?: string;
        pattern: string;
        flags?: string;
        include?: string[];
        exclude?: string[];
        maxFileSizeBytes?: number;
      },
      { toolCall },
    ) => {
      if (hasParentTraversal(input?.path)) throw new Error("Path escapes workspace: invalid path");

      const dir = await getDirectoryHandle(joinUnderWorkspace(workspaceDir, input?.path || ""));
      const matches = await grep(dir, {
        pattern: input.pattern,
        flags: input.flags,
        include: input.include,
        exclude: input.exclude,
        maxFileSize: input.maxFileSizeBytes ?? 20 * 1024 * 1024,
      });

      const payload = { count: matches.length, matches } as const;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_grep",
      description:
        "Recursive regex search under a workspace-relative path. Uses JavaScript RegExp; inline PCRE flags like (?i) are not supported—use the flags parameter (e.g., 'i' for case-insensitive).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", default: "" },
          pattern: { type: "string" },
          flags: { type: "string" },
          include: { type: "array", items: { type: "string" } },
          exclude: { type: "array", items: { type: "string" } },
          maxFileSizeBytes: { type: "number" },
        },
        required: ["pattern"],
      },
    },
  );

  const opfsReadFile = Tool(
    async (input: { file: string; offset?: number; limit?: number }, { toolCall }) => {
      if (hasParentTraversal(input?.file)) throw new Error("Path escapes workspace: invalid file");

      const root = await getOPFSRoot();
      const full = joinUnderWorkspace(workspaceDir, input.file);
      const res = await processSingleFileContent(full, workspaceDir, root, input.offset, input.limit);
      const payload = { ...res, file: full } as const;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_read_file",
      description: "Read a workspace file (text/media/PDF) with optional line range.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string" },
          offset: { type: "number" },
          limit: { type: "number" },
        },
        required: ["file"],
      },
    },
  );

  const opfsWriteFile = Tool(
    async (input: { file: string; content: string }, { toolCall }) => {
      if (hasParentTraversal(input?.file)) throw new Error("Path escapes workspace: invalid file");

      await gate.check("opfs_write_file", workspaceDir, { file: input.file });

      const full = joinUnderWorkspace(workspaceDir, input.file);
      await writeFileAtRoot(full, input.content);
      const payload = { ok: true, file: full } as const;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_write_file",
      description: "Write text to a workspace file (approval-gated).",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string" },
          content: { type: "string" },
        },
        required: ["file", "content"],
      },
    },
  );

  const opfsDeleteFile = Tool(
    async (input: { file: string }, { toolCall }) => {
      if (hasParentTraversal(input?.file)) throw new Error("Path escapes workspace: invalid file");

      await gate.check("opfs_delete_file", workspaceDir, { file: input.file });

      const full = joinUnderWorkspace(workspaceDir, input.file);
      await deleteFileAtRoot(full);
      const payload = { ok: true, file: full } as const;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_delete_file",
      description: "Delete a workspace file (approval-gated).",
      parameters: {
        type: "object",
        properties: { file: { type: "string" } },
        required: ["file"],
      },
    },
  );

  const opfsPatch = Tool(
    async (input: { diff: string; cwd?: string }, { toolCall }) => {
      if (hasParentTraversal(input?.cwd)) throw new Error("Path escapes workspace: invalid cwd");

      await gate.check("opfs_patch", workspaceDir, { summary: input.diff.slice(0, 200) });

      const root = await getOPFSRoot();
      const workDir = joinUnderWorkspace(workspaceDir, input?.cwd || "");
      const result = await applyPatchInOPFS({ root, workDir, diffContent: input.diff });
      const payload = { ...result, cwd: workDir };
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_patch",
      description: "Apply a unified diff to workspace (approval-gated).",
      parameters: {
        type: "object",
        properties: {
          diff: {
            type: "string",
            description: `Unified diff string that describes the changes to apply to the workspace. Must follow the standard unified diff format with --- and +++ file headers and @@ hunk markers (can be left empty). Do not include any extra text, explanations, or wrapper lines—only the raw diff. Supports file additions (/dev/null as source), deletions, and renames (with a/ and b/ prefixes).`,
          },
        },
        required: ["diff"],
      },
    },
  );

  const opfsUploadFiles = Tool(
    async (
      input: {
        destSubdir?: string;
        overwrite?: "replace" | "skip" | "rename";
        files: File[];
      },
      { toolCall },
    ) => {
      if (hasParentTraversal(input?.destSubdir)) throw new Error("Path escapes workspace: invalid destSubdir");

      await gate.check("opfs_upload_files", workspaceDir, {
        destSubdir: input?.destSubdir,
        count: input?.files?.length ?? 0,
      });

      const destRoot = await getDirectoryHandle(joinUnderWorkspace(workspaceDir, input?.destSubdir || ""));
      const res = await uploadFilesToDirectory(destRoot, input.files, {
        overwrite: input?.overwrite,
      });
      const payload = res;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_upload_files",
      description: "Upload provided files into the workspace (approval-gated).",
      parameters: {
        type: "object",
        properties: {
          destSubdir: { type: "string", default: "" },
          overwrite: { type: "string", enum: ["replace", "skip", "rename"] },
          files: { type: "array", items: { type: "object" } },
        },
        required: ["files"],
      },
    },
  );

  const opfsDownload = Tool(
    async (input: { file: string }, { toolCall }) => {
      if (hasParentTraversal(input?.file)) throw new Error("Path escapes workspace: invalid file");

      const full = joinUnderWorkspace(workspaceDir, input.file);
      await downloadFromRoot(full);
      const payload = { ok: true, file: full } as const;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_download",
      description: "Trigger a browser download for a workspace file.",
      parameters: {
        type: "object",
        properties: { file: { type: "string" } },
        required: ["file"],
      },
    },
  );

  const opfsMoveFile = Tool(
    async (input: { from: string; to: string }, { toolCall }) => {
      if (hasParentTraversal(input?.from)) throw new Error("Path escapes workspace: invalid from");
      if (hasParentTraversal(input?.to)) throw new Error("Path escapes workspace: invalid to");

      await gate.check("opfs_move_file", workspaceDir, { from: input.from, to: input.to });

      const fullFrom = joinUnderWorkspace(workspaceDir, input.from);
      const fullTo = joinUnderWorkspace(workspaceDir, input.to);

      await moveFileAtRoot(fullFrom, fullTo);

      const payload = { ok: true, from: fullFrom, to: fullTo } as const;
      return {
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
        data: payload,
      };
    },
    {
      name: "opfs_move_file",
      description: "Move or rename a workspace file (approval-gated).",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["from", "to"],
      },
    },
  );

  return [
    opfsShell,
    opfsLs,
    opfsGrep,
    opfsReadFile,
    opfsWriteFile,
    opfsDeleteFile,
    opfsPatch,
    opfsUploadFiles,
    opfsDownload,
    opfsMoveFile,
  ];
}
