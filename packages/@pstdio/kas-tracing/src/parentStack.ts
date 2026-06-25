import type { RunTree } from "langsmith";

// Fallback parent lookup for tracers invoked without an explicit parent handle.
// JS is single-threaded and the agent loop awaits each LLM call in turn, so the
// top of the stack is the active root while a run is in flight.
const stack: RunTree[] = [];

export function pushParent(run: RunTree) {
  stack.push(run);
}

export function popParent(run: RunTree) {
  const index = stack.lastIndexOf(run);
  if (index >= 0) stack.splice(index, 1);
}

export function currentParent(): RunTree | undefined {
  return stack[stack.length - 1];
}

export function clearParents() {
  stack.length = 0;
}
