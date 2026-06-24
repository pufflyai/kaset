import type { ApprovalRequest, RequestApproval } from "@pstdio/kas";

let handler: RequestApproval | null = null;

export function setApprovalHandler(h: RequestApproval | null) {
  handler = h;
}

export async function requestApproval(req: ApprovalRequest) {
  if (handler) return handler(req);
  return false;
}
