import type { BaseMessage } from "@pstdio/tiny-ai-tasks";
import { beforeEach, describe, expect, it } from "vitest";
import { beginAgentRun } from "./beginAgentRun";
import { configureTracing } from "./client";
import { clearParents } from "./parentStack";
import { createRecordingClient, fakeModel, makeAssistant, throwingModel } from "./test-utils";
import { traceModel } from "./traceModel";

const userMessages: BaseMessage[] = [{ role: "user", content: "hi" }];

async function drain(model: ReturnType<typeof fakeModel>, input: unknown) {
  const snapshots: unknown[] = [];
  const gen = model(input as any);

  while (true) {
    const next = await gen.next();
    if (next.done) return { snapshots, returned: next.value };
    snapshots.push(next.value);
  }
}

let recording: ReturnType<typeof createRecordingClient>;

beforeEach(() => {
  recording = createRecordingClient();
  configureTracing({ enabled: true, client: recording.client });
  clearParents();
});

describe("traceModel streaming contract", () => {
  it("yields the same snapshots and returns the same final message", async () => {
    const snapA = makeAssistant("par");
    const snapB = makeAssistant("partial");
    const final = makeAssistant("partial answer", { total_tokens: 3 });

    const handle = beginAgentRun("kas-agent", { messages: userMessages });
    const traced = traceModel(fakeModel([snapA, snapB], final), { parent: handle });

    const { snapshots, returned } = await drain(traced, userMessages);

    expect(snapshots).toEqual([
      [snapA, undefined, undefined],
      [snapB, undefined, undefined],
    ]);
    expect(returned).toBe(final);
  });
});

describe("traceModel run recording", () => {
  it("records an llm run with messages in and assistant + usage out", async () => {
    const final = makeAssistant("answer", { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });

    const handle = beginAgentRun("kas-agent", { messages: userMessages });
    const traced = traceModel(fakeModel([], final), { parent: handle, model: "gpt-5", provider: "openai" });

    await drain(traced, userMessages);
    await recording.flush();

    const llm = recording.byType("llm")[0];
    expect(llm.run_type).toBe("llm");
    expect(llm.inputs).toEqual({ messages: userMessages });
    expect((llm.outputs as any).messages).toEqual([final]);
    expect((llm.outputs as any).usage_metadata).toEqual({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
    expect((llm.extra as any).metadata.ls_model_name).toBe("gpt-5");
    expect((llm.extra as any).metadata.ls_provider).toBe("openai");
    expect(llm.ended).toBe(true);
  });

  it("accepts the object input form { messages, tools, sessionId }", async () => {
    const final = makeAssistant("answer");
    const handle = beginAgentRun("kas-agent", { messages: userMessages });
    const traced = traceModel(fakeModel([], final), { parent: handle });

    await drain(traced, { messages: userMessages, sessionId: "s1" });
    await recording.flush();

    expect(recording.byType("llm")[0].inputs).toEqual({ messages: userMessages });
  });

  it("records an error and rethrows when the inner model throws", async () => {
    const boom = new Error("model exploded");
    const handle = beginAgentRun("kas-agent", { messages: userMessages });
    const traced = traceModel(throwingModel([makeAssistant("par")], boom), { parent: handle });

    await expect(drain(traced, userMessages)).rejects.toThrow("model exploded");
    await recording.flush();

    const llm = recording.byType("llm")[0];
    expect(llm.error).toContain("model exploded");
    expect(llm.ended).toBe(true);
  });
});
