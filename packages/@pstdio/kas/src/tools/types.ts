import { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { ApprovalGate } from "../approval";

export interface OPFSToolOptions {
  rootDir: string;
  approvalGate: ApprovalGate;
}

export interface ToolResult<Data = unknown> {
  messages: {
    role: string;
    tool_call_id: string;
    content: string;
  }[];
  data?: Data;
}

export type ToolRunner<Params = unknown, Data = unknown> = (
  params: Params,
  config: ToolConfig,
) => Promise<ToolResult<Data>>;

export type OPFSToolRunner<Params = unknown, Data = unknown> = (options: OPFSToolOptions) => ToolRunner<Params, Data>;
