export { buildInitialConversation } from "./adapter/buildInitialConversation";
export { toConversation } from "./adapter/toConversation";
export { createKasAgent } from "./agent";
export { createApprovalGate, DEFAULT_APPROVAL_GATED_TOOLS } from "./approval";
export type { ApprovalRequest, RequestApproval } from "./approval";
export { systemPrompt as defaultSystemPrompt } from "./prompts";
