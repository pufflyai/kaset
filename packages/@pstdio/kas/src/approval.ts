export type ApprovalRequest = { tool: string; workspaceDir: string; detail?: any };
export type RequestApproval = (req: ApprovalRequest) => Promise<boolean>;
export type Workspace = { workspaceDir: string };

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
  const needs = new Set(needsApproval);
  const key = (tool: string, dir: string) => `${tool}:${dir}`;

  async function check(tool: string, workspaceDir: string, detail?: any) {
    if (!needs.has(tool)) return;

    const k = key(tool, workspaceDir);
    if (cache.has(k)) return;
    if (!requestApproval) throw new Error(`Approval required for ${tool} in ${workspaceDir}`);

    const ok = await requestApproval({ tool, workspaceDir, detail });
    if (!ok) throw new Error(`Denied: ${tool} in ${workspaceDir}`);

    cache.add(k);
  }

  return { check };
}
