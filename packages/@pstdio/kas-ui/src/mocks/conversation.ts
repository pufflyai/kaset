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

const toolInvocationLsComplete: ToolInvocation = {
  type: "tool-opfs_ls",
  toolCallId: "opfs-ls-complete",
  state: "output-available",
  input: { path: "/src" },
  output: {
    entries: [
      { path: "components/", kind: "directory" },
      { path: "hooks/", kind: "directory" },
      { path: "App.tsx", kind: "file" },
      { path: "timeline.mock.ts", kind: "file" },
    ],
  },
};

const toolInvocationReadFile: ToolInvocation = {
  type: "tool-opfs_read_file",
  toolCallId: "opfs-read-file",
  state: "output-available",
  input: { file: "/src/components/Timeline.tsx" },
  output: {
    file: "/src/components/Timeline.tsx",
    returnDisplay: 'import { Timeline } from "@pstdio/kas-ui";',
  },
};

const toolInvocationWriteFile: ToolInvocation = {
  type: "tool-opfs_write_file",
  toolCallId: "opfs-write-file",
  state: "output-available",
  input: {
    file: "/src/components/Timeline.tsx",
    content: 'export const TimelineTitle = "Kas Timeline";\n',
  },
  output: {
    previousContent: 'export const TimelineTitle = "Timeline";\n',
  },
};

const toolInvocationShell: ToolInvocation = {
  type: "tool-opfs_shell",
  toolCallId: "opfs-shell-test",
  state: "output-available",
  input: { command: "npm test" },
  output: {
    stdout: "PASS packages/@pstdio/kas-ui/src/timeline.test.tsx",
    stderr: "",
    exitCode: 0,
  },
};

const toolInvocationSearch: ToolInvocation = {
  type: "tool-search",
  toolCallId: "search-docs",
  state: "output-available",
  input: { query: "kas timeline component" },
  output: {
    hits: [
      {
        title: "Kas Timeline API",
        url: "https://docs.pstdio.dev/kas/timeline",
        snippet: "Timeline renders tool invocations with diff previews and summaries.",
      },
      {
        title: "Kas Agent Overview",
        url: "https://docs.pstdio.dev/kas/overview",
        snippet: "Learn how the Kas agent orchestrates tools and renders UI updates.",
      },
    ],
  },
};

const toolInvocationBrowser: ToolInvocation = {
  type: "tool-browser",
  toolCallId: "browser-open-docs",
  state: "output-available",
  input: { url: "https://docs.pstdio.dev/kas/timeline" },
  output: {
    status: 200,
    note: "Captured page metadata and stored summary in session context.",
  },
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
  lsComplete: toolInvocationLsComplete,
  readFile: toolInvocationReadFile,
  writeFile: toolInvocationWriteFile,
  shell: toolInvocationShell,
  search: toolInvocationSearch,
  browser: toolInvocationBrowser,
};
