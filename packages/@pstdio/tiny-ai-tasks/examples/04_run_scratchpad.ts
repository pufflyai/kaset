import {
  createAgent,
  createLLMTask,
  createScratchpad,
  createScratchpadTool,
  mergeStreamingMessages,
} from "../src/index";
import type { MessageHistory } from "../src/index";
import { prompt } from "@pstdio/prompt-utils";

// Create a host-side scratchpad and expose it as a tool
const scratch = createScratchpad({ notes: [] });
const scratchTool = createScratchpadTool(scratch);

// Set up an agent that can use the scratchpad tool
const agent = createAgent({
  template: [
    {
      role: "system",
      content: prompt`
        You can write brief notes to a scratchpad via the 'scratchpad' tool.
        Use it to outline your plan before answering. Keep scratchpad entries concise.
        Treat the scratchpad as private working memory: do not tell the user that you used it or added notes.
      `,
    },
  ],
  llm: createLLMTask({ model: "gpt-5-mini" }),
  tools: [scratchTool],
});

const conversation = [
  {
    role: "user" as const,
    content: "Plan a small JS project and outline tasks step-by-step. USE THE SCRATCHPAD.",
  },
];

let history: MessageHistory = [];

console.log("Thinking...");

// Stream the agent's incremental outputs and display full conversation
for await (const [newMessages] of agent(conversation)) {
  history = mergeStreamingMessages(history, newMessages);
  console.clear();
  console.log(JSON.stringify(history, null, 2));
}

// Inspect what the model wrote to the scratchpad
console.log("\nScratchpad contents:\n", JSON.stringify(scratch.get(), null, 2));
