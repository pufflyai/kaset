import { beforeEach, describe, expect, it } from "vitest";
import { beginAgentRun } from "./beginAgentRun";
import { configureTracing } from "./client";
import { clearParents } from "./parentStack";
import { createRecordingClient } from "./test-utils";

let recording: ReturnType<typeof createRecordingClient>;

beforeEach(() => {
  recording = createRecordingClient();
  configureTracing({ enabled: true, client: recording.client });
  clearParents();
});

describe("beginAgentRun", () => {
  it("creates a chain root run with the given inputs", async () => {
    const handle = beginAgentRun("kas-agent", { messages: [{ role: "user", content: "hi" }] });
    await recording.flush();

    const root = recording.byType("chain")[0];
    expect(handle).not.toBeNull();
    expect(root.name).toBe("kas-agent");
    expect(root.inputs).toEqual({ messages: [{ role: "user", content: "hi" }] });
  });

  it("finalizes the root run on end with outputs", async () => {
    const handle = beginAgentRun("kas-agent", { messages: [] });
    await handle?.end({ status: "ok" });
    await recording.flush();

    const root = recording.byType("chain")[0];
    expect(root.outputs).toEqual({ status: "ok" });
    expect(root.ended).toBe(true);
  });

  it("records an error on the root run", async () => {
    const handle = beginAgentRun("kas-agent", { messages: [] });
    await handle?.error(new Error("run failed"));
    await recording.flush();

    expect(recording.byType("chain")[0].error).toContain("run failed");
  });

  it("returns null when tracing is disabled", () => {
    configureTracing({ enabled: false });
    expect(beginAgentRun("kas-agent", {})).toBeNull();
  });
});
