export type { Tool } from "@pstdio/tiny-ai-tasks";

export { createKasAgent } from "./agent";

export { createApprovalGate } from "./approval";

export type { ApprovalGate, ApprovalRequest, CreateApprovalGateOptions, RequestApproval } from "./approval";

export { systemPrompt } from "./prompts";
