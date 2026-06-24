import { openaiModel } from "../src/llm/openaiModel";
import { MemorySaver } from "../src/runtime";

const runOptions = {
  runId: "example1",
  checkpointer: new MemorySaver(),
};

const task = openaiModel({ model: "gpt-5-mini" });

const messages = [
  {
    role: "user" as const,
    content: "Write a haiku about software development.",
  },
];

for await (const [newMessages] of task(messages, runOptions)) {
  console.clear();
  console.log(JSON.stringify(newMessages, null, 2));
}
