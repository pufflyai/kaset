import type { BaseMessage } from "@pstdio/tiny-ai-tasks";
import { beforeEach, describe, expect, it } from "vitest";
import { beginAgentRun } from "./beginAgentRun";
import { configureTracing } from "./client";
import { clearParents } from "./parentStack";
import { createRecordingClient, fakeModel, makeAssistant } from "./test-utils";
import { traceModel } from "./traceModel";

const userMessages: BaseMessage[] = [{ role: "user", content: "hi" }];

async function drain(model: ReturnType<typeof fakeModel>, input: unknown) {
  const gen = model(input as any);
  while (!(await gen.next()).done) {
    /* exhaust */
  }
}

let recording: ReturnType<typeof createRecordingClient>;

beforeEach(() => {
  recording = createRecordingClient();
  configureTracing({ enabled: true, client: recording.client });
  clearParents();
});

describe("nesting", () => {
  it("attaches the llm child to the explicit parent agent run", async () => {
    const handle = beginAgentRun("kas-agent", { messages: userMessages });
    const traced = traceModel(fakeModel([], makeAssistant("answer")), { parent: handle });

    await drain(traced, userMessages);
    await recording.flush();

    const llm = recording.byType("llm")[0];
    expect(llm.parent_run_id).toBe(handle?.runTree.id);
  });

  it("falls back to the active run on the parent stack when no parent is passed", async () => {
    const handle = beginAgentRun("kas-agent", { messages: userMessages });
    const traced = traceModel(fakeModel([], makeAssistant("answer")));

    await drain(traced, userMessages);
    await recording.flush();

    expect(recording.byType("llm")[0].parent_run_id).toBe(handle?.runTree.id);
  });

  it("keeps concurrent agent runs separate via explicit parents", async () => {
    const h1 = beginAgentRun("agent-1", { messages: userMessages });
    const h2 = beginAgentRun("agent-2", { messages: userMessages });

    const m1 = traceModel(fakeModel([], makeAssistant("a1")), { parent: h1 });
    const m2 = traceModel(fakeModel([], makeAssistant("a2")), { parent: h2 });

    await Promise.all([drain(m1, userMessages), drain(m2, userMessages)]);
    await recording.flush();

    const llms = recording.byType("llm");
    const parents = new Set(llms.map((r) => r.parent_run_id));
    expect(parents).toEqual(new Set([h1?.runTree.id, h2?.runTree.id]));
  });
});
