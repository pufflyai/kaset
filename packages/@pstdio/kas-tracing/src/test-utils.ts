import type { Client } from "langsmith";
import type { AssistantMessage, Model } from "@pstdio/tiny-ai-tasks";

export interface RecordedRun {
  id: string;
  name: string;
  run_type: string;
  parent_run_id?: string;
  inputs?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  ended: boolean;
}

// A minimal stand-in for the LangSmith Client that records the create/update calls
// RunTree.postRun()/patchRun() make, so assertions stay offline and deterministic.
export function createRecordingClient() {
  const runs = new Map<string, RecordedRun>();
  const order: string[] = [];

  const client = {
    createRun: async (run: any) => {
      runs.set(run.id, {
        id: run.id,
        name: run.name,
        run_type: run.run_type,
        parent_run_id: run.parent_run_id,
        inputs: run.inputs,
        extra: run.extra,
        ended: false,
      });
      order.push(run.id);
    },
    updateRun: async (id: string, update: any) => {
      const rec = runs.get(id);
      if (!rec) return;
      if (update.outputs !== undefined) rec.outputs = update.outputs;
      if (update.error !== undefined) rec.error = update.error;
      if (update.end_time !== undefined) rec.ended = true;
    },
    batchIngestRuns: async () => {},
    multipartIngestRuns: async () => {},
  };

  const list = () => order.map((id) => runs.get(id) as RecordedRun);

  return {
    client: client as unknown as Client,
    list,
    byType: (type: string) => list().filter((r) => r.run_type === type),
    // Let fire-and-forget postRun()/patchRun() microtasks settle before asserting.
    flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

export function makeAssistant(content: string, usage?: AssistantMessage["usage"]): AssistantMessage {
  return { role: "assistant", content, ...(usage ? { usage } : {}) };
}

// A fake Model that yields the given snapshots as [message, snapshot, ...] tuples and
// returns the final message, matching the real Task streaming contract.
export function fakeModel(snapshots: AssistantMessage[], final: AssistantMessage): Model {
  const fn = async function* (_input: unknown) {
    for (const snapshot of snapshots) {
      yield [snapshot, undefined, undefined];
    }
    return final;
  };

  return attachTaskMethods(fn, final);
}

export function throwingModel(snapshots: AssistantMessage[], err: Error): Model {
  const fn = async function* (_input: unknown) {
    for (const snapshot of snapshots) {
      yield [snapshot, undefined, undefined];
    }
    throw err;
  };

  return attachTaskMethods(fn, snapshots[snapshots.length - 1]);
}

function attachTaskMethods(fn: (input: unknown) => AsyncGenerator<unknown[], unknown>, final: unknown) {
  return Object.assign(fn, {
    invoke: async () => final,
    resume: async function* () {
      return final;
    },
  }) as unknown as Model;
}
