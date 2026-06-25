import { beforeEach, describe, expect, it } from "vitest";
import { beginAgentRun } from "./beginAgentRun";
import { configureTracing, isTracingEnabled } from "./client";
import { clearParents } from "./parentStack";
import { createRecordingClient, fakeModel, makeAssistant } from "./test-utils";
import { traceModel } from "./traceModel";

beforeEach(() => {
  configureTracing({ enabled: false });
  clearParents();
});

describe("configureTracing", () => {
  it("is disabled by default", () => {
    expect(isTracingEnabled()).toBe(false);
  });

  it("stays disabled when enabled but no key or client is provided", () => {
    configureTracing({ enabled: true });
    expect(isTracingEnabled()).toBe(false);
  });

  it("enables when an injected client is provided", () => {
    const { client } = createRecordingClient();
    configureTracing({ enabled: true, client });
    expect(isTracingEnabled()).toBe(true);
  });

  it("can be turned back off", () => {
    const { client } = createRecordingClient();
    configureTracing({ enabled: true, client });
    configureTracing({ enabled: false });
    expect(isTracingEnabled()).toBe(false);
  });
});

describe("disabled passthrough", () => {
  it("beginAgentRun returns null", () => {
    expect(beginAgentRun("kas-agent", { messages: [] })).toBeNull();
  });

  it("traceModel returns the original model reference", () => {
    const model = fakeModel([], makeAssistant("done"));
    expect(traceModel(model)).toBe(model);
  });
});
