export interface TextUIPart {
  type: "text";
  text: string;
  state?: "streaming" | "done";
}

export interface ReasoningUIPart {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
}

export interface SourceUrlUIPart {
  type: "source-url";
  sourceId: string;
  url: string;
  title?: string;
}

export interface SourceDocumentUIPart {
  type: "source-document";
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
}

export interface FileUIPart {
  type: "file";
  mediaType: string;
  filename?: string;
  url: string;
}

export type ToolInvocation = {
  type: `tool-${string}`;
  toolCallId: string;
} & (
  | {
      type: `tool-${string}`;
      toolCallId: string;
    }
  | {
      state: "input-streaming";
      input: any;
      providerExecuted?: boolean;
      output?: never;
      errorText?: never;
    }
  | {
      state: "input-available";
      input: any;
      providerExecuted?: boolean;
      output?: never;
      errorText?: never;
    }
  | {
      state: "output-available";
      input: any;
      output: any;
      errorText?: never;
      providerExecuted?: boolean;
    }
  | {
      state: "output-error";
      input: any;
      rawInput?: unknown;
      output?: never;
      errorText: string;
    }
);

export interface ToolInvocationUIPart {
  type: "tool-invocation";
  toolInvocation: ToolInvocation;
}

export interface Message {
  id: string;
  createdAt?: Date;
  streaming?: boolean;
  attachments?: Array<{
    contentType: string;
    name: string;
    size: number;
    url: string;
  }>;
  role: "user" | "assistant";
  parts: Array<
    TextUIPart | ReasoningUIPart | ToolInvocationUIPart | FileUIPart | SourceUrlUIPart | SourceDocumentUIPart
  >;
}

export type UIConversation = Message[];
