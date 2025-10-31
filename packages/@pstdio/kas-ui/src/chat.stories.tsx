import { Box, Button, Flex, Link, Stack, Text, VStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CassetteTapeIcon } from "lucide-react";
import { ToolInvocation, UIMessage } from "./adapters/kas";
import { ConversationContent, ConversationRoot, ConversationScrollButton } from "./components/ai-conversation";
import { AutoScroll } from "./components/auto-scroll";
import { ChangeBubble } from "./components/change-bubble";
import { ChatInput } from "./components/chat-input";
import { EmptyState } from "./components/empty-state";
import { MessageList } from "./components/message-list";
import { emptyConversation, examplePrompts, toolInvocationConversation } from "./mocks/conversation";
import { summarizeConversationChanges } from "./utils/diff";
import { generateEditorStateFromString } from "./components/rich-text/prompt-input/utils";

interface ChatPlaygroundProps {
  messages: UIMessage[];
  streaming?: boolean;
  canSend?: boolean;
  examplePrompts?: string[];
}

const userMessagesCount = (messages: UIMessage[]): number => {
  return messages.reduce((count, message) => (message.role === "user" ? count + 1 : count), 0);
};

const createEditorStateFromText = (value: string) => {
  return JSON.stringify(generateEditorStateFromString(value));
};

const emptyEditorState = createEditorStateFromText("");

const createMessageId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createUserMessage = (text: string): UIMessage => ({
  id: createMessageId("user"),
  role: "user",
  createdAt: new Date(),
  parts: [
    {
      type: "text",
      text,
      state: "done",
    },
  ],
});

const createAssistantStreamingMessage = (id: string): UIMessage => ({
  id,
  role: "assistant",
  streaming: true,
  createdAt: new Date(),
  parts: [
    {
      type: "text",
      text: "Thinking…",
      state: "streaming",
    },
  ],
});

const createAssistantReply = (id: string, userText: string, toolInvocations: ToolInvocation[]): UIMessage => {
  const textLines = ["### Storybook Reply", "", "You said:", `> ${userText}`, ""];

  if (toolInvocations.length > 0) {
    textLines.push("Kas used these tools:");
    toolInvocations.forEach((invocation) => {
      textLines.push(`- ${describeToolInvocation(invocation)}`);
    });
    textLines.push("");
  } else {
    textLines.push("Kas completed this reply without invoking tools.", "");
  }

  textLines.push("Here’s a simulated answer so you can preview the Kas chat experience.");

  return {
    id,
    role: "assistant",
    createdAt: new Date(),
    parts: [
      {
        type: "text",
        text: textLines.join("\n"),
        state: "done",
      },
    ],
  };
};

const createAssistantInterruptedMessage = (id: string): UIMessage => ({
  id,
  role: "assistant",
  createdAt: new Date(),
  parts: [
    {
      type: "text",
      text: "⏹️ Generation stopped.",
      state: "done",
    },
  ],
});

const getUserSnippet = (text: string) => {
  const condensed = text.replace(/\s+/g, " ").trim();
  if (condensed.length <= 60) return condensed;
  return `${condensed.slice(0, 57)}...`;
};

const toolInvocationFactories: Array<(userText: string) => ToolInvocation> = [
  (_userText) => {
    const directories = [
      {
        path: "/src",
        entries: [
          { path: "components/", kind: "directory" },
          { path: "hooks/", kind: "directory" },
          { path: "App.tsx", kind: "file" },
        ],
      },
      {
        path: "/src/components",
        entries: [
          { path: "chat/", kind: "directory" },
          { path: "message-list.tsx", kind: "file" },
          { path: "tool-invocation-timeline.tsx", kind: "file" },
        ],
      },
      {
        path: "/packages/@pstdio/kas-ui/src",
        entries: [
          { path: "chat.stories.tsx", kind: "file" },
          { path: "components/", kind: "directory" },
          { path: "mocks/", kind: "directory" },
        ],
      },
    ];
    const selection = directories[Math.floor(Math.random() * directories.length)];
    return {
      type: "tool-opfs_ls",
      toolCallId: createMessageId("tool-opfs_ls"),
      state: "output-available",
      input: { path: selection.path },
      output: selection,
    };
  },
  (_userText) => {
    const files = [
      {
        file: "/src/components/chat-input.tsx",
        preview: "handleSubmit ensures whitespace-trimmed messages before sending.",
      },
      {
        file: "/src/components/message-list.tsx",
        preview: "MessageList groups consecutive tool invocations into collapsible timelines.",
      },
      {
        file: "/src/components/change-bubble.tsx",
        preview: "ChangeBubble surfaces additions and deletions detected in the conversation.",
      },
    ];
    const selection = files[Math.floor(Math.random() * files.length)];
    return {
      type: "tool-opfs_read_file",
      toolCallId: createMessageId("tool-opfs_read_file"),
      state: "output-available",
      input: { file: selection.file },
      output: {
        file: selection.file,
        preview: selection.preview,
      },
    };
  },
  (userText) => {
    const snippet = getUserSnippet(userText);
    const commands = [
      "npm run lint -- --filter=@pstdio/kas-ui",
      "npm run build --workspace @pstdio/kas-ui",
      "npm run test -- --runInBand",
    ];
    const command = commands[Math.floor(Math.random() * commands.length)];
    return {
      type: "tool-opfs_shell",
      toolCallId: createMessageId("tool-opfs_shell"),
      state: "output-available",
      input: { command },
      output: {
        exitCode: 0,
        stdout: `Simulated ${command} OK while preparing response for "${snippet}".`,
        stderr: "",
      },
    };
  },
  (userText) => {
    const snippet = getUserSnippet(userText) || "kas agent prompts";
    return {
      type: "tool-search",
      toolCallId: createMessageId("tool-search"),
      state: "output-available",
      input: { query: snippet },
      output: {
        hits: [
          {
            title: "Kas agent docs",
            url: "https://kaset.dev/docs",
            snippet: `Reference for responding to: "${snippet}".`,
          },
          {
            title: "Kas UI components",
            url: "https://kaset.dev/docs/ui",
            snippet: "Component catalog for interactive agent experiences.",
          },
        ],
      },
    };
  },
  (userText) => {
    const snippet = getUserSnippet(userText);
    const diff = [
      "diff --git a/src/agent.ts b/src/agent.ts",
      "--- a/src/agent.ts",
      "+++ b/src/agent.ts",
      "@@",
      '-const summary = "Todo";',
      `+const summary = "Handled: ${snippet || "recent user request"}";`,
    ].join("\n");
    return {
      type: "tool-opfs_patch",
      toolCallId: createMessageId("tool-opfs_patch"),
      state: "output-available",
      input: { diff },
      output: {
        details: {
          modified: ["src/agent.ts"],
        },
      },
    };
  },
];

const createRandomToolInvocations = (userText: string): ToolInvocation[] => {
  const available = [...toolInvocationFactories];
  const count = Math.min(available.length, 2 + Math.floor(Math.random() * 2));
  const invocations: ToolInvocation[] = [];

  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * available.length);
    const [factory] = available.splice(index, 1);
    invocations.push(factory(userText));
  }

  return invocations;
};

const createToolInvocationMessage = (toolInvocation: ToolInvocation, id?: string): UIMessage => ({
  id: id ?? createMessageId("assistant-tool"),
  role: "assistant",
  createdAt: new Date(),
  parts: [
    {
      type: "tool-invocation",
      toolInvocation,
    },
  ],
});

const createToolInvocationStreamingMessage = (toolInvocation: ToolInvocation, id: string): UIMessage => {
  const streamingInvocation = {
    type: toolInvocation.type,
    toolCallId: toolInvocation.toolCallId,
    state: "input-streaming",
    input: (toolInvocation as any).input,
    providerExecuted: false,
  } as ToolInvocation;

  return {
    id,
    role: "assistant",
    streaming: true,
    createdAt: new Date(),
    parts: [
      {
        type: "tool-invocation",
        toolInvocation: streamingInvocation,
      },
    ],
  };
};

const describeToolInvocation = (invocation: ToolInvocation) => {
  const friendlyName = invocation.type.replace(/^tool-/, "").replace(/_/g, " ");
  const input = (invocation as any).input ?? {};

  if (input && typeof input === "object") {
    if ("path" in input) return `\`${friendlyName}\` on ${(input as any).path}`;
    if ("file" in input) return `\`${friendlyName}\` reading ${(input as any).file}`;
    if ("command" in input) return `\`${friendlyName}\` running ${(input as any).command}`;
    if ("query" in input) return `\`${friendlyName}\` searching for ${(input as any).query}`;
    if ("diff" in input) return `\`${friendlyName}\` applying a diff`;
  }

  return `\`${friendlyName}\` call`;
};

const firstToolDelayMs = 900; // Delay before the first tool starts streaming
const toolRunDurationMs = 800; // Time each tool spends in a streaming state before completing
const betweenToolDelayMs = 250; // Gap between tool completions and the next tool starting
const finalReplyDelayMs = 1000; // Delay after the final tool before the assistant reply

const markdownConversation: UIMessage[] = [
  {
    id: "markdown-user-1",
    role: "user",
    createdAt: new Date("2024-01-01T09:00:00Z"),
    parts: [
      {
        type: "text",
        text: `## Release Planning\n\nHey Kas, can you summarize where we are for the v0.4 launch?\n\n- [ ] Docs updates\n- [ ] Marketing checklist\n- [ ] Regression tests`,
        state: "done",
      },
    ],
  },
  {
    id: "markdown-assistant-1",
    role: "assistant",
    createdAt: new Date("2024-01-01T09:00:08Z"),
    parts: [
      {
        type: "text",
        text: `Here's a quick snapshot:\n\n> Release window: **Jan 12 – Jan 19**\n\n### Summary\n- Docs PR [#482](https://github.com/pstdio/kaset/pull/482) merged\n- Marketing deck in [Slides](https://slides.pstdio.dev/kaset/v0.4)\n- Regression suite passing except for \`payments.spec.ts\`\n\nI'll keep the checklist updated as we go.`,
        state: "done",
      },
    ],
  },
  {
    id: "markdown-user-2",
    role: "user",
    createdAt: new Date("2024-01-01T09:02:00Z"),
    parts: [
      {
        type: "text",
        text: `Great! Can you draft a release note outline with sections for highlights, fixes, and migration steps?`,
        state: "done",
      },
    ],
  },
  {
    id: "markdown-assistant-2",
    role: "assistant",
    createdAt: new Date("2024-01-01T09:02:10Z"),
    parts: [
      {
        type: "text",
        text: `### Release Notes Outline\n\n#### Highlights\n- ✅ Visual diff viewer for tool outputs\n- ✅ New OPFS sync adapters\n- ✅ Faster warm start for Kas runtime\n\n#### Fixes\n- #451: Handle large multi-file patches\n- #465: Prevent prompt cache eviction in offline mode\n\n#### Migration\n1. Run \`npm run reset:all\`\n2. Update env var: \`KAS_AGENT_MODE=playground\`\n3. Regenerate OPFS token using \`kas-cli login\`\n\nWant me to turn this into a full markdown doc?`,
        state: "done",
      },
    ],
  },
  {
    id: "markdown-user-3",
    role: "user",
    createdAt: new Date("2024-01-01T09:03:45Z"),
    parts: [
      {
        type: "text",
        text: `Yes, generate the full release notes and attach links to the testing artifacts.`,
        state: "done",
      },
    ],
  },
];

const ChatPlaceholder = (props: {
  canSend: boolean;
  examplePrompts: string[];
  onUseExample: (prompt: string) => void;
}) => {
  const { canSend, examplePrompts, onUseExample } = props;
  const promptsToShow = examplePrompts.slice(0, 4);
  const showPrompts = canSend && promptsToShow.length > 0;

  return (
    <Box w="100%">
      <EmptyState
        icon={<CassetteTapeIcon />}
        title="Welcome to the Kaset playground!"
        description="Kaset [ka'set] is an experimental open source toolkit to make your webapps agentic and customizable by your users."
      >
        <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
          Check out our{" "}
          <Link color="blue" href="https://kaset.dev">
            documentation
          </Link>
          .
        </Text>

        {showPrompts && (
          <VStack gap="sm" mt="sm" align="stretch">
            <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
              Try one of these example prompts to see what it can do:
            </Text>
            {promptsToShow.map((prompt) => (
              <Button key={prompt} variant="outline" size="sm" onClick={() => onUseExample(prompt)}>
                {prompt}
              </Button>
            ))}
          </VStack>
        )}
      </EmptyState>
    </Box>
  );
};

const ChatPlayground = (props: ChatPlaygroundProps) => {
  const { canSend = true, examplePrompts: examplePromptOverrides, messages, streaming = false } = props;
  const [conversation, setConversation] = useState<UIMessage[]>(messages);
  const [streamingState, setStreamingState] = useState(streaming);
  const [editorState, setEditorState] = useState<string>(() => emptyEditorState);
  const prompts = examplePromptOverrides ?? examplePrompts;
  const replyTimeoutRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const activeResponseRef = useRef<{ id: string; userText: string } | null>(null);

  const clearReplyTimeouts = useCallback(() => {
    replyTimeoutRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    replyTimeoutRef.current.clear();
  }, []);

  const scheduleReplyTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      replyTimeoutRef.current.delete(timeoutId);
      callback();
    }, delay);

    replyTimeoutRef.current.add(timeoutId);
  }, []);

  const hasMessages = conversation.length > 0;

  const conversationChanges = useMemo(() => summarizeConversationChanges(conversation), [conversation]);
  const showChangeBubble = conversationChanges.fileCount > 0;

  useEffect(() => {
    setConversation(messages);
  }, [messages]);

  useEffect(() => {
    setStreamingState(streaming);
  }, [streaming]);

  useEffect(() => {
    return () => {
      clearReplyTimeouts();
    };
  }, [clearReplyTimeouts]);

  const handleUseExample = useCallback(
    (text: string) => {
      console.info("use example", text);
      if (!canSend) return;
      setEditorState(createEditorStateFromText(text));
    },
    [canSend],
  );

  const handleSubmit = useCallback(
    (text: string, attachments: string[]) => {
      if (!canSend || streamingState) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      console.info("send message", trimmed);
      if (attachments.length > 0) {
        console.info("with attachments", attachments);
      }
      const assistantId = createMessageId("assistant");
      const userMessage = createUserMessage(trimmed);
      const streamingMessage = createAssistantStreamingMessage(assistantId);

      setConversation((prev) => [...prev, userMessage, streamingMessage]);
      setStreamingState(true);
      activeResponseRef.current = { id: assistantId, userText: trimmed };

      clearReplyTimeouts();

      const toolInvocations = createRandomToolInvocations(trimmed);
      const totalTools = toolInvocations.length;

      let accumulatedDelay = firstToolDelayMs;

      toolInvocations.forEach((toolInvocation, index) => {
        const toolMessageId = createMessageId("assistant-tool");
        const startDelay = accumulatedDelay;
        const completionDelay = startDelay + toolRunDurationMs;

        scheduleReplyTimeout(() => {
          setConversation((prev) => {
            let inserted = false;
            const next: UIMessage[] = [];

            for (const message of prev) {
              if (message.id !== assistantId) {
                next.push(message);
                continue;
              }

              const progressText = `Running tools (${Math.min(index + 1, totalTools)}/${totalTools})…`;

              const updatedStreaming: UIMessage = {
                ...message,
                parts: message.parts.map((part) => {
                  if (part.type !== "text") return part;
                  return {
                    ...part,
                    text: progressText,
                    state: "streaming",
                  };
                }),
              };

              next.push(createToolInvocationStreamingMessage(toolInvocation, toolMessageId));
              next.push(updatedStreaming);
              inserted = true;
            }

            return inserted ? next : prev;
          });
        }, startDelay);

        scheduleReplyTimeout(() => {
          setConversation((prev) =>
            prev.map((message) => {
              if (message.id === toolMessageId) {
                return createToolInvocationMessage(toolInvocation, toolMessageId);
              }

              if (message.id !== assistantId) return message;

              const progressText =
                index + 1 === totalTools ? "Wrapping up…" : `Queued next tool (${index + 1}/${totalTools})…`;

              return {
                ...message,
                parts: message.parts.map((part) => {
                  if (part.type !== "text") return part;
                  return {
                    ...part,
                    text: progressText,
                    state: "streaming",
                  };
                }),
              };
            }),
          );
        }, completionDelay);

        accumulatedDelay = completionDelay + betweenToolDelayMs;
      });

      const finalDelay = accumulatedDelay + finalReplyDelayMs;
      const draftingDelay = accumulatedDelay + Math.max(200, Math.floor(finalReplyDelayMs * 0.5));

      if (draftingDelay < finalDelay) {
        scheduleReplyTimeout(() => {
          setConversation((prev) =>
            prev.map((message) => {
              if (message.id !== assistantId) return message;
              return {
                ...message,
                parts: message.parts.map((part) => {
                  if (part.type !== "text") return part;
                  return {
                    ...part,
                    text: "Drafting reply…",
                    state: "streaming",
                  };
                }),
              };
            }),
          );
        }, draftingDelay);
      }

      scheduleReplyTimeout(() => {
        setConversation((prev) =>
          prev.map((message) =>
            message.id === assistantId ? createAssistantReply(assistantId, trimmed, toolInvocations) : message,
          ),
        );
        setStreamingState(false);
        activeResponseRef.current = null;
      }, finalDelay);

      setEditorState(emptyEditorState);
    },
    [canSend, streamingState, clearReplyTimeouts, scheduleReplyTimeout],
  );

  const handleInterrupt = useCallback(() => {
    if (!streamingState) return;

    clearReplyTimeouts();

    const active = activeResponseRef.current;

    if (!active) {
      setConversation((prev) => prev.filter((message) => !message.streaming));
    } else {
      setConversation((prev) =>
        prev.map((message) => (message.id === active.id ? createAssistantInterruptedMessage(active.id) : message)),
      );
    }

    activeResponseRef.current = null;
    setStreamingState(false);
  }, [clearReplyTimeouts, streamingState]);

  return (
    <Box width="100%" maxW="100%" height="100%" display="flex" flexDirection="column">
      <ConversationRoot>
        <AutoScroll userMessageCount={userMessagesCount(conversation)} />
        <ConversationContent>
          {hasMessages ? (
            <MessageList messages={conversation} streaming={streamingState} />
          ) : (
            <ChatPlaceholder canSend={canSend} examplePrompts={prompts} onUseExample={handleUseExample} />
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="Scroll to latest" />
      </ConversationRoot>

      <Flex padding="sm">
        <Stack direction="column" gap="sm" width="full">
          <Flex align="center" justify="space-between" gap="sm" wrap="wrap">
            {showChangeBubble && (
              <ChangeBubble
                additions={conversationChanges.additions}
                deletions={conversationChanges.deletions}
                fileCount={conversationChanges.fileCount}
                streaming={streamingState}
              />
            )}
          </Flex>
          <Stack direction="column" gap="xs">
            <ChatInput
              defaultState={editorState}
              placeholder="Ask Kaset something..."
              streaming={streamingState}
              isDisabled={!canSend && !streamingState}
              onSubmit={handleSubmit}
              onInterrupt={handleInterrupt}
            />
          </Stack>
        </Stack>
      </Flex>
    </Box>
  );
};

const meta: Meta<typeof ChatPlayground> = {
  title: "Kas UI/Chat",
  component: ChatPlayground,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (StoryFn) => (
      <Box height="100%">
        <StoryFn />
      </Box>
    ),
  ],
  args: {
    messages: toolInvocationConversation,
    streaming: false,
    canSend: true,
  },
};

export default meta;

type Story = StoryObj<typeof ChatPlayground>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    messages: emptyConversation,
  },
};

export const ReadOnly: Story = {
  args: {
    canSend: false,
  },
};

export const MarkdownConversation: Story = {
  args: {
    messages: markdownConversation,
  },
};
