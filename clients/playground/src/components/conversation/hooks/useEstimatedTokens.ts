import { toMessageHistory } from "@/services/ai/utils";
import type { Message } from "@/types";
import { roughCounter, type BaseMessage } from "@pstdio/tiny-ai-tasks";
import { useMemo } from "react";

export function useEstimatedTokens(messages: Message[], input: string) {
  return useMemo(() => {
    const history = toMessageHistory(messages);
    const trimmed = input.trim();
    const withCurrent: BaseMessage[] = trimmed
      ? [...history, { role: "user", content: trimmed } as BaseMessage]
      : history;

    const counter = roughCounter();
    return counter.count(withCurrent);
  }, [messages, input]);
}
