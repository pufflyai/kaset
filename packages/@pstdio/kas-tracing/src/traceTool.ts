import type { Tool } from "@pstdio/tiny-ai-tasks";
import type { AgentRunHandle } from "./beginAgentRun";
import { isTracingEnabled } from "./client";
import { noop, stringifyError } from "./internal";
import { currentParent } from "./parentStack";

export interface TraceToolMeta {
  parent?: AgentRunHandle | null;
}

// Wrap a Tool so each call becomes a child "tool" run. Preserves `definition` so the
// agent's tool dispatch (which matches by definition.name) keeps working.
export function traceTool<P, R>(tool: Tool<P, R>, meta: TraceToolMeta = {}): Tool<P, R> {
  if (!isTracingEnabled()) return tool;

  return {
    definition: tool.definition,
    run: async (params, config) => {
      const parent = meta.parent?.runTree ?? currentParent();
      if (!parent) return tool.run(params, config);

      const run = parent.createChild({
        name: tool.definition.name,
        run_type: "tool",
        inputs: toInputs(params),
      });

      void run.postRun().catch(noop);

      try {
        const result = await tool.run(params, config);

        await run.end({ output: result }).catch(noop);
        await run.patchRun().catch(noop);

        return result;
      } catch (err) {
        await run.end(undefined, stringifyError(err)).catch(noop);
        await run.patchRun().catch(noop);

        throw err;
      }
    },
  };
}

function toInputs(params: unknown): Record<string, unknown> {
  if (params && typeof params === "object" && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }

  return { input: params };
}
