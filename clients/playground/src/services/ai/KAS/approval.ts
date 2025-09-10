export type ApprovalRequest = {
  tool: string;
  workspaceDir: string;
  detail?: any;
};

type ApprovalHandler = (req: ApprovalRequest) => Promise<boolean>;

let handler: ApprovalHandler | null = null;

export function setApprovalHandler(h: ApprovalHandler | null) {
  handler = h;
}

export async function requestApproval(req: ApprovalRequest): Promise<boolean> {
  if (handler) return handler(req);
  // Default safe fallback: deny when no handler is registered
  return false;
}

export type Workspace = { workspaceDir: string };

export type RequestApproval = (info: { tool: string; workspaceDir: string; detail?: any }) => Promise<boolean>;

export const DEFAULT_APPROVAL_GATED_TOOLS = [
  "opfs_write_file",
  "opfs_delete_file",
  "opfs_patch",
  "opfs_upload_files",
  "opfs_move_file",
] as const;

export function createApprovalGate(
  requestApproval?: RequestApproval,
  needsApproval: readonly string[] = DEFAULT_APPROVAL_GATED_TOOLS,
) {
  const cache = new Set<string>();
  const needsApprovalSet = new Set(needsApproval);

  function key(tool: string, workspaceDir: string) {
    return `${tool}:${workspaceDir}`;
  }

  async function check(tool: string, workspaceDir: string, detail?: any) {
    if (!needsApprovalSet.has(tool)) return;

    const k = key(tool, workspaceDir);
    if (cache.has(k)) return;

    if (!requestApproval) throw new Error(`Approval required for ${tool} in ${workspaceDir}`);
    const ok = await requestApproval({ tool, workspaceDir, detail });
    if (!ok) throw new Error(`Denied: ${tool} in ${workspaceDir}`);

    cache.add(k);
  }

  return { check };
}
