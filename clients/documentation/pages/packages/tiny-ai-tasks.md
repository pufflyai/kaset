---
title: "@pstdio/tiny-ai-tasks"
---

# @pstdio/tiny-ai-tasks

Composable AI workflows and tool-using agents for TypeScript/JavaScript. Stream LLM outputs, call tools mid-stream, summarize history, and iterate.

## Install

```bash
npm i @pstdio/tiny-ai-tasks @pstdio/tiny-tasks
```

Provide your OpenAI API key via `OPENAI_API_KEY` or pass `apiKey` to the LLM task.

## Quick Start

```ts
import { createLLMTask } from "@pstdio/tiny-ai-tasks";
import { MemorySaver } from "@pstdio/tiny-tasks";

const llm = createLLMTask({ model: "gpt-5-mini" });

const opts = { runId: "demo", checkpointer: new MemorySaver() };
const messages = [{ role: "user" as const, content: "Write a haiku about databases." }];

for await (const [assistant] of llm(messages, opts)) {
  if (assistant) console.log(assistant.content);
}
```

## Add a Tool

```ts
import { createLLMTask, Tool } from "@pstdio/tiny-ai-tasks";

const weather = Tool(async (location: string) => ({ location, temperature: 72, condition: "Sunny" }), {
  name: "weather",
  description: "Get current weather for a location",
  parameters: {
    type: "object",
    properties: { location: { type: "string" } },
    required: ["location"],
  },
});

const llm = createLLMTask({ model: "gpt-5-mini" });

for await (const [assistant] of llm({
  messages: [{ role: "user" as const, content: "What’s the weather in Miami?" }],
  tools: [weather],
})) {
  if (assistant) console.log(assistant.tool_calls);
}
```

## A Tiny Agent

```ts
import { createAgent, createLLMTask, Tool } from "@pstdio/tiny-ai-tasks";

const news = Tool(async (topic: string = "general") => ({ topic, articles: [{ title: "Demo" }] }), {
  name: "news",
  description: "Fetch the latest news for a topic.",
  parameters: { type: "object", properties: { topic: { type: "string" } } },
});

const agent = createAgent({
  template: [{ role: "system", content: "You are a concise analyst." }],
  llm: createLLMTask({ model: "gpt-5-mini" }),
  tools: [news],
});

for await (const [msgs] of agent([{ role: "user", content: "Summarize today’s tech news." }])) {
  if (msgs) console.log(msgs);
}
```

## Summarize & Trim History

```ts
import { createLLMTask, createSummarizer, truncateToBudget } from "@pstdio/tiny-ai-tasks";

const callLLM = createLLMTask({ model: "gpt-5-mini" });
const summarize = createSummarizer(callLLM);

const history = [
  { role: "system" as const, content: "Rules" },
  { role: "user" as const, content: "Long conversation…" },
];

// Deterministic truncation (no LLM)
const compact = truncateToBudget(history, { budget: 200 });

// Or LLM-based compression of the middle slice
for await (const [msgs] of summarize({ history, opts: { budget: 200, markSummary: true } })) {
  if (msgs) console.log(msgs);
}
```

## Optional Scratchpad Tool

```ts
import { createScratchpad, createScratchpadTool, createLLMTask } from "@pstdio/tiny-ai-tasks";

const scratch = createScratchpad();
const scratchTool = createScratchpadTool(scratch);

const llm = createLLMTask({ model: "gpt-5-mini" });
const input = { messages: [{ role: "user" as const, content: "Plan a trip" }], tools: [scratchTool] };

for await (const _ of llm(input)) {
}
console.log("scratch:", scratch.get());
```

## API Overview

- createLLMTask(options): Stream assistant deltas with accumulated `tool_calls`.
- createAgent({ template?, llm, tools?, maxTurns? }): Minimal loop that plans → runs tools → continues.
- Tool(run, definition): Define a JSON‑schema validated tool; returns `{ messages, data? }` or a plain value.
- createToolTask(tools): Route a `ToolCall` to the matching tool and package a `ToolResult`.
- toOpenAITools(tools): Convert tools to OpenAI’s `tools` shape.
- messages: `filterHistory`, `mergeHistory`, `toBaseMessages`.
- summarize: `truncateToBudget`, `createSummarizer`, `roughCounter`, `TokenCounter`.

## Notes

- Pass OpenAI credentials via env or `apiKey`; use `baseUrl` for proxies/compatible endpoints.
- The last stream chunk may include `usage` metrics; the final assistant message includes them.
- Import `MemorySaver` from `@pstdio/tiny-tasks` for demo checkpointing; swap for persistence in production.
