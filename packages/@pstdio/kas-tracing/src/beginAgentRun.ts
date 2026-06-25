import { RunTree } from "langsmith";
import { getClient, getProject, isTracingEnabled } from "./client";
import { noop, stringifyError } from "./internal";
import { popParent, pushParent } from "./parentStack";

export interface AgentRunHandle {
  runTree: RunTree;
  end: (outputs?: Record<string, unknown>) => Promise<void>;
  error: (err: unknown) => Promise<void>;
}

// Start a root run for a whole agent invocation. Returns null when tracing is off,
// so callers can `handle?.end(...)` with zero overhead in the disabled case.
export function beginAgentRun(name: string, inputs: Record<string, unknown>): AgentRunHandle | null {
  if (!isTracingEnabled()) return null;

  const runTree = new RunTree({
    name,
    run_type: "chain",
    inputs,
    client: getClient(),
    project_name: getProject(),
    tracingEnabled: true,
  });

  pushParent(runTree);

  // Fire-and-forget: a failed trace POST must never block or break the agent.
  void runTree.postRun().catch(noop);

  const finish = async (outputs?: Record<string, unknown>, err?: unknown) => {
    popParent(runTree);

    await runTree.end(outputs, err != null ? stringifyError(err) : undefined).catch(noop);
    await runTree.patchRun().catch(noop);
  };

  return {
    runTree,
    end: (outputs) => finish(outputs),
    error: (err) => finish(undefined, err),
  };
}
