import type { BaseMessage, Role } from "../utils/messageTypes";

/** Metadata that travels *with* messages but shouldn’t always reach the LLM */
export interface MessageMeta {
  hidden?: boolean; // strip when calling LLM
  summary?: boolean; // e.g., summarization marker
  tags?: string[]; // ad-hoc selectors: "plan", "debug", "scratchpad"
}

export interface ExtendedMessage extends BaseMessage {
  meta?: MessageMeta;
}

/** Select a slice of history for a particular consumer (LLM, UI, audit, etc.) */
export function filterHistory(
  history: ExtendedMessage[],
  opts: { includeRoles?: Role[]; excludeHidden?: boolean; tags?: string[] } = {},
): ExtendedMessage[] {
  const { includeRoles, excludeHidden = false, tags } = opts;
  return history.filter((m) => {
    if (excludeHidden && m.meta?.hidden) return false;
    if (includeRoles?.length && !includeRoles.includes(m.role)) return false;
    if (tags?.length) {
      const mt = m.meta?.tags ?? [];
      const any = tags.some((t) => mt.includes(t));
      if (!any) return false;
    }
    return true;
  });
}

/** Stable merge with de‑duplication (ignoring meta); meta is *unioned* when duplicates collide. */
export function mergeHistory(a: ExtendedMessage[], b: ExtendedMessage[]): ExtendedMessage[] {
  type Key = string;

  const hash = (m: ExtendedMessage): Key => {
    const clone: any = { ...m };
    delete clone.meta;
    if (clone.tool_calls) {
      clone.tool_calls = clone.tool_calls.map((c: any) => ({
        id: c.id,
        type: c.type,
        function: { name: c.function?.name, arguments: c.function?.arguments },
      }));
    }
    if (clone.tool_call_id) clone.tool_call_id = String(clone.tool_call_id);
    return JSON.stringify(clone);
  };

  const mergeMeta = (x?: MessageMeta, y?: MessageMeta): MessageMeta | undefined => {
    if (!x && !y) return undefined;
    const tags = Array.from(new Set([...(x?.tags ?? []), ...(y?.tags ?? [])]));
    const hidden = !!(x?.hidden || y?.hidden);
    const summary = !!(x?.summary || y?.summary);
    const out: MessageMeta = {};
    if (tags.length) out.tags = tags;
    if (hidden) out.hidden = true;
    if (summary) out.summary = true;
    return Object.keys(out).length ? out : undefined;
  };

  const out: ExtendedMessage[] = [];
  const idx = new Map<Key, number>();

  const push = (m: ExtendedMessage) => {
    const k = hash(m);
    if (!idx.has(k)) {
      const clone: ExtendedMessage = { ...m, meta: m.meta ? { ...m.meta } : undefined };
      idx.set(k, out.push(clone) - 1);
      return;
    }
    const i = idx.get(k)!;
    out[i].meta = mergeMeta(out[i].meta, m.meta);
  };

  for (const m of a) push(m);
  for (const m of b) push(m);
  return out;
}

/** QoL: drop .meta so you can pass the result straight to createLLMTask */
export function toBaseMessages(history: ExtendedMessage[]): BaseMessage[] {
  return history.map((m) => {
    const { meta: _, ...rest } = m as any;
    return rest as BaseMessage;
  });
}
