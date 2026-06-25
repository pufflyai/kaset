import { Tool } from "@pstdio/tiny-ai-tasks";
import { beforeEach, describe, expect, it } from "vitest";
import { beginAgentRun } from "./beginAgentRun";
import { configureTracing } from "./client";
import { clearParents } from "./parentStack";
import { createRecordingClient } from "./test-utils";
import { traceTool } from "./traceTool";

const echoTool = Tool(async (params: { value: string }) => ({ echoed: params.value }), {
  name: "echo",
  description: "echoes its input",
});

let recording: ReturnType<typeof createRecordingClient>;

beforeEach(() => {
  recording = createRecordingClient();
  configureTracing({ enabled: true, client: recording.client });
  clearParents();
});

describe("traceTool", () => {
  it("returns the original tool when tracing is disabled", () => {
    configureTracing({ enabled: false });
    expect(traceTool(echoTool)).toBe(echoTool);
  });

  it("preserves the tool definition so dispatch by name still works", () => {
    const handle = beginAgentRun("kas-agent", {});
    expect(traceTool(echoTool, { parent: handle }).definition).toBe(echoTool.definition);
  });

  it("records a tool run with inputs and outputs and returns the real result", async () => {
    const handle = beginAgentRun("kas-agent", {});
    const traced = traceTool(echoTool, { parent: handle });

    const result = await traced.run({ value: "hello" }, {});
    await recording.flush();

    expect(result).toEqual({ echoed: "hello" });

    const toolRun = recording.byType("tool")[0];
    expect(toolRun.name).toBe("echo");
    expect(toolRun.inputs).toEqual({ value: "hello" });
    expect((toolRun.outputs as any).output).toEqual({ echoed: "hello" });
    expect(toolRun.ended).toBe(true);
  });
});
