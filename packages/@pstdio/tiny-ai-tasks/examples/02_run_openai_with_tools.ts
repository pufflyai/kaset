import { MemorySaver } from "../src/runtime";
import { createLLMTask } from "../src/llm/createLLMTask";
import { Tool } from "../src/tools/Tool";

const runOptions = {
  runId: "example1",
  checkpointer: new MemorySaver(),
};

const weatherTool = Tool(
  async () => {
    return {
      location: "New York",
      temperature: 75,
      condition: "Sunny",
    };
  },
  {
    name: "weather",
    description: "Get the current weather for a given location.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The location to get the weather for.",
        },
      },
      required: ["location"],
    },
  },
);

const task = createLLMTask({ model: "gpt-5-mini" });

const messages = [
  {
    role: "user" as const,
    content: "What's the weather like in New York?.",
  },
];

for await (const [newMessages] of task({ messages, tools: [weatherTool] }, runOptions)) {
  console.clear();
  console.log(JSON.stringify(newMessages, null, 2));
}
