import { createRuntime } from "@pstdio/tiny-tasks";

export const runtime = createRuntime();

export const { task, MemorySaver, Command, Channel, LastValue, GraphInterrupt } = runtime;
