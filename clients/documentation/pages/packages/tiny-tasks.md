---
title: "@pstdio/tiny-tasks"
---

# @pstdio/tiny-tasks

Composable, interrupt-friendly workflows for TypeScript/JavaScript. Turn async functions into checkpoint-able generators that can pause, persist, and resume.

## Install

```bash
npm i @pstdio/tiny-tasks
```

## Quick Start

```ts
import { createRuntime } from "@pstdio/tiny-tasks";

const { task, MemorySaver } = createRuntime();

const saver = new MemorySaver();
const opts = { runId: "demo", checkpointer: saver };

const workflow = task("workflow", async function* (name: string, ctx) {
  yield `processing ${name}`;
  const resume = ctx.interrupt({ message: "wait" });
  yield `done: ${resume.message}`;
});

// first run – yields once and interrupts
for await (const [msg, , intr] of workflow("job", opts)) {
  if (msg) console.log(msg);
  if (intr) console.log("interrupt →", intr);
}

// resume after external work is finished
for await (const [msg] of workflow.resume({ message: "ok" }, opts)) {
  if (msg) console.log(msg);
}
```

## Examples

### Nested streaming

```ts
const step = task("step", async function* (q: string) {
  yield `processing ${q}`;
  yield `done: ${q}`;
});

const aggregate = task("aggregate", async function* (q: string) {
  const state: string[] = [];
  for await (const [msg] of step(q)) {
    if (msg) state.push(msg as string);
    yield state.slice();
  }
  return [...state, "aggregate done"];
});

for await (const [partial] of aggregate("task")) {
  console.log(partial);
}
```

### Nested interrupts

```ts
const inner = task("inner", async function* (_: void, ctx) {
  ctx.interrupt("stop");
  yield "resumed";
});

const outer = task("outer", async function* (_: void, ctx) {
  for await (const [msg, , intr] of inner()) {
    if (msg) yield msg;
    if (intr) ctx.interrupt(intr);
  }
  return "done";
});

for await (const [msg, , intr] of outer()) {
  console.log(msg, intr);
}
```

## API Overview

- task: Wrap an async generator. Use `ctx.interrupt(value)` inside to pause and persist.
- createRuntime: Browser-friendly initializer returning `{ task, MemorySaver, ... }`.
- MemorySaver: In-memory checkpoint store for demos/tests.

Each task yields tuples `[partial, snapshot, interrupt]` during execution and supports:

- `.invoke(input, opts)` – run to completion and resolve final result
- `.resume(value, opts)` – resume after an interrupt

## Notes & Caveats

- Use a consistent `runId` when resuming to locate prior checkpoints.
- Avoid mutating shared state between yields; earlier steps may re-run on resume.
- The default `MemorySaver` is ephemeral; implement your own saver for persistence.
