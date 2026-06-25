# @pstdio/kas-tracing

Browser-first [LangSmith](https://smith.langchain.com/) tracing for `@pstdio` AI agents.

Wrap a `Model` or `Tool` from [`@pstdio/tiny-ai-tasks`](../tiny-ai-tasks) and stream nested runs to
LangSmith — a root agent run with child LLM and tool spans — entirely from the browser with a
user-provided API key. It uses the LangSmith `RunTree` API with explicit parent references (no
`AsyncLocalStorage`), so nesting works client-side.

When tracing is off, every wrapper is a zero-overhead passthrough.

## Usage

```ts
import { beginAgentRun, configureTracing, traceModel, traceTool } from "@pstdio/kas-tracing";

// Configure once per run from your settings (key stored browser-local).
configureTracing({
  enabled: settings.tracingEnabled,
  apiKey: settings.langsmithApiKey,
  project: "kaset",
});

// Start a root run, then wrap the model and tools under it.
const run = beginAgentRun("kas-agent", { messages });
const model = traceModel(openaiModel({ model: "gpt-5", apiKey }), {
  model: "gpt-5",
  provider: "openai",
  parent: run,
});
const tools = baseTools.map((tool) => traceTool(tool, { parent: run }));

try {
  // ...drive the agent with `model` + `tools`...
  await run?.end({ status: "ok" });
} catch (err) {
  await run?.error(err);
  throw err;
}
```

`beginAgentRun` returns `null` when tracing is disabled, and `traceModel` / `traceTool` return their
argument unchanged, so the wiring above costs nothing when off.

## API

- `configureTracing({ enabled, apiKey?, project?, endpoint?, client? })` — set up (or tear down) tracing.
  `client` is an injection seam for tests.
- `isTracingEnabled()` — whether runs will be sent.
- `beginAgentRun(name, inputs)` — start a root `chain` run; returns a handle with `end(outputs?)` /
  `error(err)`, or `null` when disabled.
- `traceModel(model, { name?, model?, provider?, parent? })` — wrap a `Model` as a child `llm` run
  (records messages in, assistant + token usage out).
- `traceTool(tool, { parent? })` — wrap a `Tool` as a child `tool` run.

A failed trace never interrupts the agent: posting is fire-and-forget and all LangSmith calls are guarded.
