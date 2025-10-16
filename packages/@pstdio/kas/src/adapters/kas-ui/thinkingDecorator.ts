import { shortUID } from "@pstdio/prompt-utils";
import { UIConversation, UIMessage } from "./types";

type ThoughtPart = {
  type: "reasoning";
  text: string;
  state: "streaming" | "done";
};

type ThoughtController = {
  id: string;
  startedAt: number;
  isClosed: boolean;
  close: (conversation: UIConversation) => UIConversation;
};

/** Adds a streaming thought message and returns it plus a controller to close it later. */
export function decorateWithThought(initial: UIConversation, shortId = shortUID) {
  const id = shortId();
  const startedAt = Date.now();
  const thinkingMessage: UIMessage = {
    id,
    role: "developer",
    meta: { hidden: true, tags: ["thinking"], startedAt },
    parts: [{ type: "reasoning", text: "Thinking...", state: "streaming" } as ThoughtPart],
  };

  let closed = false;

  const close = (conversation: UIConversation): UIConversation => {
    if (closed) return conversation;
    const finishedAt = Date.now();
    const durationMs = Math.max(0, finishedAt - startedAt);
    const secs = Math.max(1, Math.round(durationMs / 1000));

    const idx = conversation.findIndex((m) => m.id === id);
    if (idx === -1) {
      closed = true;
      return [
        {
          ...thinkingMessage,
          meta: { hidden: true, finishedAt, durationMs },
          parts: [{ type: "reasoning", text: `Thought for ${secs} seconds`, state: "done" }],
        } as UIMessage,
        ...conversation,
      ];
    }

    closed = true;

    const msg = conversation[idx];
    const updated = {
      ...msg,
      meta: { ...(msg.meta ?? {}), hidden: true, finishedAt, durationMs },
      parts: [{ type: "reasoning", text: `Thought for ${secs} seconds`, state: "done" }],
    } as UIMessage;

    const next = conversation.slice();
    next[idx] = updated;
    return next;
  };

  return {
    messages: [...initial, thinkingMessage],
    thought: {
      id,
      startedAt,
      isClosed: false,
      close,
    } as ThoughtController,
  };
}

export function withClosedThoughts(conversation: UIConversation, thought: ThoughtController) {
  return thought.close(conversation);
}
