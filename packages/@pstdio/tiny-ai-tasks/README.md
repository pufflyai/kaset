# Tiny AI Tasks

[![npm version](https://img.shields.io/npm/v/@pstdio/tiny-ai-tasks.svg?color=blue)](https://www.npmjs.com/package/@pstdio/tiny-ai-tasks)
[![license](https://img.shields.io/npm/l/@pstdio/tiny-ai-tasks)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Ftiny-ai-tasks)](https://bundlephobia.com/package/%40pstdio%2Ftiny-ai-tasks)

> Composable AI workflows and tool-using agents for TypeScript / JavaScript
> Stream LLM outputs, call tools, summarize context, and iterate.

## ✨ Why?

Modern AI apps need to:

- stream partial model output as it’s generated,
- call tools/functions mid-stream and fold results back into history,
- keep conversation history compact within token budgets, and
- remain resumable and composable like regular async code.

`tiny-ai-tasks` builds on `@pstdio/tiny-tasks` to provide:

- a streaming LLM task (OpenAI client) with tool-call accumulation,
- a minimal agent loop that plans → calls tools → continues,
- a deterministic history truncator and an LLM-based summarizer, and
- small message utilities and an optional scratchpad tool.

## 🏁 Quick start

### Installation

```sh
npm i @pstdio/tiny-ai-tasks @pstdio/tiny-tasks
```

You can provide your OpenAI API key via environment (`OPENAI_API_KEY`) or pass it directly as `apiKey`.

### Stream a response

```ts
import { createLLMTask } from "@pstdio/tiny-ai-tasks";
import { MemorySaver } from "@pstdio/tiny-tasks";

const run = createLLMTask({ model: "gpt-5-mini" });

const opts = { runId: "demo", checkpointer: new MemorySaver() };
const messages = [{ role: "user" as const, content: "Write a haiku about databases." }];

for await (const [assistant] of run(messages, opts)) {
  if (assistant) console.log(assistant.content);
}
```

### Add a tool

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

const run = createLLMTask({ model: "gpt-5-mini" });

const input = {
  messages: [{ role: "user" as const, content: "What’s the weather in Miami?" }],
  tools: [weather],
};

for await (const [assistant] of run(input)) {
  // assistant.tool_calls will fill in as the stream arrives
  if (assistant) console.log(assistant);
}
```

### A tiny tool agent

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

## 📚 Examples

### Summarize/compact a long history

```ts
import { createLLMTask, createSummarizer, truncateToBudget } from "@pstdio/tiny-ai-tasks";

const callLLM = createLLMTask({ model: "gpt-5-mini" });
const summarize = createSummarizer(callLLM);

const history = [
  { role: "system" as const, content: "Rules" },
  { role: "user" as const, content: "Long conversation…" },
  // …
];

// Deterministic truncate (no LLM)
const compact = truncateToBudget(history, { budget: 200 });

// Or use the summarizer to compress the middle slice into a developer note
for await (const [msgs] of summarize({ history, opts: { budget: 200, markSummary: true } })) {
  if (msgs) console.log(msgs);
}
```

### Optional scratchpad tool

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

## 📖 API

- createLLMTask(options)
  - Streams `AssistantMessage` deltas and accumulates `tool_calls`.
  - Options: `model`, `apiKey?`, `baseUrl?`, `temperature?`, `reasoning? { effort }`, `dangerouslyAllowBrowser?`.
  - Accepts either `BaseMessage[]` or `{ messages: BaseMessage[]; tools?: Tool[] }`.

- createAgent({ template?, llm, tools?, maxTurns? })
  - Minimal loop: call `llm` with history, append assistant message, run each tool call, repeat.
  - Yields only newly produced messages each turn.

- Tool(run, definition)
  - Define a tool with JSON Schema `parameters` and an async `run(params, config)`.
  - Return either `{ messages, data? }` or a plain value (wrapped automatically).

- createToolTask(tools)
  - Routes a `ToolCall` to the matching tool, validating JSON args and packaging `ToolResult`.

- toOpenAITools(tools)
  - Converts internal tools to OpenAI’s `tools` shape.

- messages
  - filterHistory(history, { includeRoles?, excludeHidden?, tags? })
  - mergeHistory(a, b) – stable dedupe and meta union
  - toBaseMessages(history) – drop `.meta` for LLM calls

- summarize
  - truncateToBudget(history, { budget, counter? }) – deterministic truncation
  - createSummarizer(callLLM) – LLM summarization of the middle slice to fit budget
  - roughCounter(), TokenCounter – extensible counting heuristic

## ℹ️ Usage notes

- Provide OpenAI credentials via env or `apiKey`; set `baseUrl` for proxies/compatible endpoints.
- The last streamed chunk may include `usage` metrics; the task attaches them to the final message.
- Tools with a single object property schema and a 1‑parameter `run` function receive that property as the positional arg.
- Import `MemorySaver` and other runtime helpers from `@pstdio/tiny-tasks` for checkpointing.
- For multiline prompts, use `prompt\`` from `@pstdio/prompt-utils` to strip indentation and tidy whitespace.

## ⚠️ Caveats

- The default `MemorySaver` is in‑memory only; swap in persistent storage for durable resumes.
- LLM outputs may repeat while resuming if you re‑enter a section of work; write idempotent tool logic.
