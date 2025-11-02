# Tiny Tasks

[![npm version](https://img.shields.io/npm/v/@pstdio/tiny-tasks.svg?color=blue)](https://www.npmjs.com/package/@pstdio/tiny-tasks)
[![license](https://img.shields.io/npm/l/@pstdio/tiny-tasks)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Ftiny-tasks)](https://bundlephobia.com/package/%40pstdio%2Ftiny-tasks)

> **Composable, interrupt-friendly workflows for TypeScript / JavaScript**
> Pause, persist, and resume long-running work in a single line of code.

For additional information, please refer to the [documentation](https://pufflyai.github.io/kaset/packages/tiny-tasks).

## ✨ Why?

Serverless functions, chat agents, and data pipelines often need to

- **stream partial results** to callers,
- **persist progress** in case the process is killed, and
- **resume work** once conditions are met or resources are available.

`tiny-tasks` turns ordinary async functions into **checkpoint-able generators** with helpers for interruption, re-hydration, and composition.

## 🏁 Quick start

### Installation

```sh
npm i @pstdio/tiny-tasks
```

```ts
import { createRuntime } from "@pstdio/tiny-tasks";

const { task, MemorySaver } = createRuntime();

const saver = new MemorySaver();
const opts = { runId: "demo", checkpointer: saver };

const workflow = task("workflow", async function* (name: string, ctx) {
  yield `processing ${name}`;
  const resume = ctx.interrupt({ message: "wait" });
  yield `done: ${resume}`;
});

// first run – yields once and interrupts
for await (const [msg, , intr] of workflow("job", opts)) {
  if (msg) console.log(msg);
  if (intr) console.log("interrupt →", intr);
}

// resume after external work is finished
for await (const [msg] of workflow.resume("resume-data", opts)) {
  if (msg) console.log(msg);
}
```

## 📚 Examples

### Nested streaming

```ts
// works in both Node and browser
const step = task("step", async function* (q: string, ctx) {
  yield `processing ${q}`;
  yield `done: ${q}`;
});

const aggregate = task("aggregate", async function* (q: string, ctx) {
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

## 📖 API

- **Node entrypoint (`import { task, interrupt, MemorySaver } from "tiny-tasks"`)**
  - `task(name, fn)` – wrap an async generator. Inside `fn`, call `interrupt(value)` to pause.

- **Browser entrypoint (`import { createRuntime } from "tiny-tasks/browser"`)**
  - `createRuntime()` → `{ task, MemorySaver, ... }`.
  - Task functions receive `(input, ctx)`; use `ctx.interrupt(value)` to pause.

- **Common to both:**
  - A task is an async generator yielding `[partial, snapshot, interrupt]`.
    - `partial`: emitted value
    - `snapshot`: current resume stack
    - `interrupt`: interrupt value, if any

  - `.invoke(input, opts)` runs to completion and resolves the final result.
  - `.resume(value, opts)` resumes after an interrupt.
  - `MemorySaver` is a built-in in-memory checkpoint store (swap it out for persistent storage).

## ℹ️ Usage notes

- Every yield from a task returns a tuple `[partial, snapshot, interrupt]`.
- Nested tasks can call each other freely – interrupts bubble up to the parent unless handled.
- Checkpoints are stored per `runId`; use a consistent identifier when resuming a task.

## ⚠️ Caveats

- The default `MemorySaver` is ephemeral (in-memory). Implement your own for persistence.
- Avoid mutating shared state between yields — if a task is interrupted and resumed, earlier yields may re-execute.
