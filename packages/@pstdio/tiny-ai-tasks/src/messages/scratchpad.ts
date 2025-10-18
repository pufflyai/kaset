import { Tool } from "../tools/Tool";
import type { ToolResult } from "../tools/createToolTask";
import type { ToolMessage } from "../utils/messageTypes";

export interface Scratchpad {
  get(): Record<string, any>;
  set(patch: Record<string, any>): void;
  clear(): void;
}

export function createScratchpad(initial: Record<string, any> = {}): Scratchpad {
  let state = { ...initial };
  return {
    get: () => ({ ...state }),
    set: (patch) => {
      const p = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : { value: patch };
      state = { ...state, ...p };
    },
    clear: () => {
      state = {};
    },
  };
}

export function createScratchpadTool(s: Scratchpad) {
  return Tool(
    async (
      { op, patch }: { op: "set" | "clear"; patch?: any },
      { toolCall }: { toolCall?: { id?: string } },
    ): Promise<ToolResult<{ ok: true }>> => {
      if (op === "set") s.set(patch);
      else if (op === "clear") s.clear();
      else throw new Error("invalid op");
      const message: ToolMessage = {
        role: "tool",
        tool_call_id: toolCall?.id ?? "",
        content: JSON.stringify({ ok: true }),
      };
      return {
        messages: [message],
        data: { ok: true },
      };
    },
    {
      name: "scratchpad",
      description:
        "Working-memory scratchpad for plans, TODOs, and short notes. " +
        "Use this before answering to outline steps or store IDs/results. " +
        "This is private working memory: do NOT tell the user you used it or that you added notes. " +
        "Persisted across turns and visible to the host (not visible to the end user). " +
        "Prefer op='set' with a concise object to merge, e.g. { plan: ['…'], todos: ['…'], facts: ['…'] }. " +
        "Use op='clear' only when starting fresh. Keep entries brief.",
      parameters: {
        type: "object",
        properties: {
          op: {
            type: "string",
            enum: ["set", "clear"],
            description: "Operation: 'set' merges the given patch into the scratchpad; 'clear' resets it.",
          },
          patch: {
            description:
              "When op='set', provide an object to merge. Suggested keys: plan, todos, facts, variables. " +
              "Values should be short strings or arrays of short strings.",
          },
        },
        required: ["op"],
      },
    },
  );
}
