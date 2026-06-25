import type { AssistantMessage, Model } from "@pstdio/tiny-ai-tasks";
import type { AgentRunHandle } from "./beginAgentRun";
import { isTracingEnabled } from "./client";
import { extractMessages, noop, stringifyError, toUsageMetadata } from "./internal";
import { currentParent } from "./parentStack";

export interface TraceModelMeta {
  name?: string;
  model?: string;
  provider?: string;
  parent?: AgentRunHandle | null;
}

type ModelInput = Parameters<Model>[0];

// Wrap a Model so each invocation becomes a child "llm" run under the active agent run.
// Returns the model unchanged when tracing is off, so wrapping is free in that case.
export function traceModel(model: Model, meta: TraceModelMeta = {}): Model {
  if (!isTracingEnabled()) return model;

  const traced = async function* (input: ModelInput) {
    const parent = meta.parent?.runTree ?? currentParent();
    if (!parent) {
      return yield* model(input);
    }

    const run = parent.createChild({
      name: meta.name ?? "llm",
      run_type: "llm",
      inputs: { messages: extractMessages(input) },
      extra: { metadata: pruneMetadata(meta) },
    });

    void run.postRun().catch(noop);

    let final: AssistantMessage | undefined;

    try {
      const inner = model(input);

      // Re-yield every [message, snapshot, ...] tuple unchanged to preserve streaming.
      while (true) {
        const next = await inner.next();
        if (next.done) {
          final = next.value ?? final;
          break;
        }

        final = next.value[0] ?? final;
        yield next.value;
      }
    } catch (err) {
      await run.end(undefined, stringifyError(err)).catch(noop);
      await run.patchRun().catch(noop);
      throw err;
    }

    const usage_metadata = toUsageMetadata(final?.usage);

    await run.end({ messages: final ? [final] : [], ...(usage_metadata ? { usage_metadata } : {}) }).catch(noop);
    await run.patchRun().catch(noop);

    return final as AssistantMessage;
  };

  // The agent loop only calls + iterates the model; invoke/resume are part of the
  // Model contract but unused here, so delegate them to the original.
  return Object.assign(traced, {
    invoke: model.invoke.bind(model),
    resume: model.resume.bind(model),
  }) as unknown as Model;
}

function pruneMetadata(meta: TraceModelMeta) {
  const metadata: Record<string, string> = {};
  if (meta.provider) metadata.ls_provider = meta.provider;
  if (meta.model) metadata.ls_model_name = meta.model;
  return metadata;
}
