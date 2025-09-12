import {
  createAgent,
  createLLMTask,
  Tool,
  mergeStreamingMessages,
  createScratchpad,
  createScratchpadTool,
} from "../src/index";
import type { MessageHistory } from "../src/index";
import { prompt } from "@pstdio/prompt-utils";

// Example: Agent that uses a scratchpad for planning + a tool for work

const scratch = createScratchpad({ plan: [] as string[], calc: {} as Record<string, any> });
const scratchTool = createScratchpadTool(scratch);

const sumTool = Tool(
  async (params: { a: number; b: number }, config) => {
    const { a, b } = params || ({} as any);

    const result = Number(a) + Number(b);

    return {
      data: { a, b, result },
      messages: [
        {
          role: "tool" as const,
          tool_call_id: config.toolCall?.id || "",
          content: JSON.stringify({ success: true, operation: "sum", a, b, result }),
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

const agent = createAgent({
  template: [
    {
      role: "system",
      content: prompt`
        You have a private working-memory scratchpad exposed via the 'scratchpad' tool.
        Before answering, write a brief plan to the scratchpad in { plan: [..] }.
        For arithmetic, call the 'sum' tool with the correct 'a' and 'b'.
        After obtaining the result, store { calc: { a, b, result } } into the scratchpad, then answer concisely.
        Do not mention the scratchpad to the user.
      `,
    },
  ],
  llm: createLLMTask({ model: "gpt-5-mini" }),
  tools: [scratchTool, sumTool],
});

async function run() {
  const conversation = [
    {
      role: "user" as const,
      content: `I have a budgeting scenario for a small prototype project and need a concise final summary of totals.

Please (1) plan your approach first (internally) then (2) use the arithmetic tool for every addition step—do NOT do mental math. Break the problem into explicit sum operations.

Data:
  Phase A tasks:
    Design research sessions cost: 128
    Wireframing cost: 347
  Phase B tasks:
    Implementation sprint 1: 915
    Implementation sprint 2: 263
  Additional contingency: 74

Objectives:
  a. Compute Phase A subtotal (128 + 347)
  b. Compute Phase B subtotal (915 + 263)
  c. Compute combined core total (Phase A subtotal + Phase B subtotal)
  d. Add contingency (core total + 74) to obtain final projected budget
  e. Report all intermediate subtotals and the final number.

Rules:
  - Use the sum tool for every single addition (even when combining previous results).
  - Store intermediate arithmetic results in your internal calculation memory before answering.
  - Final user answer: one concise paragraph listing Phase A subtotal, Phase B subtotal, core total, final total.
  - Do not reveal internal planning or the way you store data.

Return only the final descriptive paragraph to me.`,
    },
  ];

  let history: MessageHistory = [];

  console.log("Thinking...");

  for await (const [newMessages] of agent(conversation)) {
    history = mergeStreamingMessages(history, newMessages);

    console.clear();
    console.log(JSON.stringify(history, null, 2));
  }

  console.log("\nScratchpad contents:\n", JSON.stringify(scratch.get(), null, 2));
}

run().catch((e) => console.error(e));
