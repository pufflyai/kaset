export type ApprovalRequest = { tool: string; workspaceDir: string; detail?: any };
export type RequestApproval = (req: ApprovalRequest) => Promise<boolean>;
export type Workspace = { workspaceDir: string };
export type ApprovalGate = { check: (tool: string, workspaceDir: string, detail?: any) => Promise<void> } | null;

export type CreateApprovalGateOptions = {
  approvalGatedTools?: readonly string[];
  requestApproval: RequestApproval;
};

export function createApprovalGate(options: CreateApprovalGateOptions) {
  const { approvalGatedTools = [], requestApproval } = options;
  const cache = new Set<string>();
  const needs = new Set(approvalGatedTools);
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

  return { check } as ApprovalGate;
}
