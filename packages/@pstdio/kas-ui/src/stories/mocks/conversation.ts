import type { ToolInvocation, UIMessage } from "@pstdio/kas/kas-ui";

const diffExample = `diff --git a/src/example.ts b/src/example.ts
index 1111111..2222222 100644
--- a/src/example.ts
+++ b/src/example.ts
@@
-const greeting = "Hello";
+const greeting = "Hello, Storybook!";
`;

const baseToolInvocation = {
  type: "tool-opfs_patch",
  toolCallId: "opfs-patch-1",
  input: { diff: diffExample },
} as const satisfies Pick<ToolInvocation, "type" | "toolCallId"> & Partial<ToolInvocation>;

export const examplePrompts = [
  "Fix the build failure",
  "Summarize the latest changes",
  "Show me the diff for src/example.ts",
  "What's the next step?",
];

const userQuestion: UIMessage = {
  id: "user-question",
  role: "user",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  parts: [
    {
      type: "text",
      text: "Can you update the greeting component to include the exclamation?",
    },
  ],
};

const assistantStreaming: UIMessage = {
  id: "assistant-streaming",
  role: "assistant",
  streaming: true,
  createdAt: new Date("2024-01-01T10:00:05Z"),
  parts: [
    {
      type: "text",
      text: "Sure, let me take a look at the project and patch the file...",
      state: "streaming",
    },
  ],
};

const assistantReply: UIMessage = {
  id: "assistant-reply",
  role: "assistant",
  createdAt: new Date("2024-01-01T10:00:25Z"),
  parts: [
    {
      type: "text",
      text: "I updated the greeting to include the exclamation mark and confirmed the component renders correctly.",
      state: "done",
    },
  ],
};

const toolInvocationPending: ToolInvocation = {
  ...baseToolInvocation,
  toolCallId: "opfs-patch-pending",
  state: "input-streaming",
  input: { diff: diffExample },
};

const toolInvocationComplete: ToolInvocation = {
  ...baseToolInvocation,
  toolCallId: "opfs-patch-complete",
  state: "output-available",
  input: { diff: diffExample },
  output: {
    details: {
      modified: ["src/example.ts"],
    },
  },
};

const toolInvocationError: ToolInvocation = {
  ...baseToolInvocation,
  toolCallId: "opfs-patch-error",
  state: "output-error",
  input: { diff: diffExample },
  errorText: "patch: unable to apply hunk at line 4",
};

export const emptyConversation: UIMessage[] = [];

export const streamingConversation: UIMessage[] = [userQuestion, assistantStreaming];

export const toolInvocationConversation: UIMessage[] = [
  userQuestion,
  {
    id: "tool-pending",
    role: "assistant",
    parts: [
      {
        type: "tool-invocation",
        toolInvocation: toolInvocationPending,
      },
    ],
  },
  {
    id: "tool-finished",
    role: "assistant",
    parts: [
      {
        type: "tool-invocation",
        toolInvocation: toolInvocationComplete,
      },
    ],
  },
  assistantReply,
];

export const toolErrorConversation: UIMessage[] = [
  userQuestion,
  {
    id: "tool-failure",
    role: "assistant",
    parts: [
      {
        type: "tool-invocation",
        toolInvocation: toolInvocationError,
      },
    ],
  },
  {
    id: "assistant-error",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "The patch failed because of a merge conflict. Could you pull the latest changes?",
      },
    ],
  },
];

export const sampleToolInvocations = {
  pending: toolInvocationPending,
  complete: toolInvocationComplete,
  error: toolInvocationError,
};
