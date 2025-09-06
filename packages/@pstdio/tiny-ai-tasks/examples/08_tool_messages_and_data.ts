import { createAgent, createLLMTask, Tool, mergeStreamingMessages } from "../src/index";
import type { MessageHistory } from "../src/index";

// Example: A tool that returns both custom messages and structured data
// The tool emits a tool message (for LLM/history) and also returns
// typed data we can parse from the tool message content.

const sumTool = Tool(
  async (params: { a: number; b: number }, config) => {
    const { a, b } = params || ({} as any);
    const sum = Number(a) + Number(b);

    return {
      data: { a, b, sum },
      messages: [
        {
          role: "tool" as const,
          tool_call_id: config.toolCall?.id || "",
          content: JSON.stringify({ success: true, operation: "sum", a, b, result: sum }),
        },
      ],
    };
  },
  {
    name: "sum",
    description: "Add two numbers and return a result.",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["a", "b"],
    },
  },
);

// Create an agent that knows to use the `sum` tool for arithmetic
const agent = createAgent({
  template: [
    {
      role: "system",
      content:
        "You are a helpful assistant. For any arithmetic addition request, use the 'sum' tool with appropriate 'a' and 'b' values, then provide the final result.",
    },
  ],
  llm: createLLMTask({ model: "gpt-5-mini" }),
  tools: [sumTool],
});

async function run() {
  const conversation = [
    {
      role: "user" as const,
      content: "Please add 2 and 40, and tell me the total.",
    },
  ];

  // Capture the final tool-produced result by parsing tool messages
  // (Agent yields messages, including the tool message emitted by our tool.)
  let resultFromToolMessage: { a: number; b: number; result: number } | undefined;

  let history: MessageHistory = [];

  console.log("Thinking...");

  for await (const [newMessages] of agent(conversation)) {
    history = mergeStreamingMessages(history, newMessages);

    console.clear();
    console.log(JSON.stringify(history, null, 2));

    for (const m of newMessages || []) {
      if (m.role === "tool" && m?.content) {
        try {
          const parsed = JSON.parse(String(m.content));
          resultFromToolMessage = { a: parsed.a, b: parsed.b, result: parsed.result };
        } catch {
          // ignore unparseable tool messages
        }
      }
    }
  }

  if (resultFromToolMessage) {
    console.log("\nExtracted data:", JSON.stringify(resultFromToolMessage, null, 2));
  }
}

run().catch((e) => console.error(e));
