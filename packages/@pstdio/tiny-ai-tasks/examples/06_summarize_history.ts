import {
  createLLMTask,
  createSummarizer,
  truncateToBudget,
  roughCounter,
  type ExtendedMessage,
  messageContentToString,
} from "../src/index";

// Example: compact a long chat history to fit a token budget
// - First: show deterministic truncation (no LLM)
// - Then: use the LLM summarizer to compress the middle slice

// Set up a mock conversation with enough content to exceed a small budget
const history: ExtendedMessage[] = [
  { role: "system", content: "You are a concise assistant that answers briefly and clearly." },

  { role: "user", content: "We are planning an onboarding flow. What are the main steps?" },
  {
    role: "assistant",
    content:
      "Onboarding flow typically includes: sign-up, email verification, profile setup, product tour, first task, and feedback.",
  },

  { role: "user", content: "We need to store preferences. Which fields do you recommend and why?" },
  {
    role: "assistant",
    content:
      "Store language, timezone, theme, notifications (email/push), tutorial_seen, and default_workspace. Keep it minimal to reduce friction.",
  },

  { role: "user", content: "Draft a JSON schema for these preferences." },
  {
    role: "assistant",
    content:
      '{ "type": "object", "properties": { "language": {"type":"string"}, "timezone": {"type":"string"}, "theme": {"type":"string","enum":["light","dark"]}, "notifications": {"type":"object","properties": {"email":{"type":"boolean"},"push":{"type":"boolean"}}}, "tutorial_seen": {"type":"boolean"}, "default_workspace": {"type":"string"} }, "required": ["language","timezone"] }',
  },

  { role: "user", content: "Great. Also list 3 risks with this onboarding approach." },
  {
    role: "assistant",
    content:
      "Risks: (1) Drop-off during email verification, (2) Over-collecting info increases friction, (3) Product tour fatigue.",
  },
];

const counter = roughCounter();
const original = counter.count(history);

// Keep budget small to force compaction
const budget = Math.max(0, Math.floor(original * 0.55));

console.log("Original token estimate:", original);
console.log("Budget:", budget);

// 1) Deterministic truncate: keeps leading system, then the newest tail
const truncated = truncateToBudget(history, { budget, counter });
console.log("\nDeterministic truncate → messages:");
for (const m of truncated) console.log(`- [${m.role}] ${messageContentToString(m.content).slice(0, 72)}...`);

// 2) LLM summarizer: compress the middle slice into one developer note
// Provide OpenAI credentials via env or pass apiKey/baseUrl to createLLMTask
const llm = createLLMTask({ model: "gpt-5-mini" });
const summarize = createSummarizer(llm);

for await (const [compacted] of summarize({ history, opts: { budget, markSummary: true } })) {
  if (!compacted) continue;

  console.log("\nSummarized history → messages:");
  for (const m of compacted as any) {
    const tag = m.meta?.summary ? " (summary)" : "";
    console.log(`- [${m.role}${tag}] ${messageContentToString(m.content)}`);
  }

  console.log("\nNew token estimate:", counter.count(compacted as any));
}
