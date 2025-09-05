import { createLLMTask, filterHistory, toBaseMessages, type ExtendedMessage } from "../src/index";

// Demonstrates using hidden developer/internal notes in history
// These notes are kept out of the LLM prompt but available for UI/audit

const llm = createLLMTask({ model: "gpt-5-mini" });

const history: ExtendedMessage[] = [
  { role: "system", content: "You are a concise assistant." },
  {
    role: "user",
    content: "hello world!",
  },
  {
    role: "developer",
    content: "Plan: fetch latest items, then present 3 bullet points.",
    meta: { hidden: true, tags: ["plan"] }, // internal note (not for the LLM)
  },
  {
    role: "user",
    content: "What was the last message you received?",
  },
];

// Build a prompt for the LLM by removing hidden messages and stripping meta
const prompt = toBaseMessages(filterHistory(history, { excludeHidden: true }));

for await (const [newMessages] of llm(prompt)) {
  console.clear();
  console.log(JSON.stringify(newMessages, null, 2));
}

// Prepare UI slices
const visible = filterHistory(history, { excludeHidden: true });
const internalPlan = filterHistory(history, { tags: ["plan"] });

console.log("\nVisible to user:");
for (const m of visible) console.log(`- [${m.role}] ${m.content}`);

console.log("\nInternal notes (hidden):");
for (const m of internalPlan) console.log(`- [${m.role}] ${m.content} (tags: ${m.meta?.tags?.join(", ")})`);
