import { toMessageHistory } from "@pstdio/kas";
import type { Message } from "@/types";
import { roughCounter, type BaseMessage } from "@pstdio/tiny-ai-tasks";
import { useMemo } from "react";

export function calculateConversationTokens(messages: Message[], input: string) {
  const history = toMessageHistory(messages);
  const counter = roughCounter();

  let total = 0;
  const runningHistory: BaseMessage[] = [];

  for (const message of history) {
    runningHistory.push(message);
    if (message.role === "user") {
      total += counter.count(runningHistory);
    }
  }

  const trimmed = input.trim();
  if (trimmed) {
    const nextHistory: BaseMessage[] = [...runningHistory, { role: "user", content: trimmed } as BaseMessage];
    total += counter.count(nextHistory);
  }

  return total;
}

export function useEstimatedTokens(messages: Message[], input: string) {
  return useMemo(() => calculateConversationTokens(messages, input), [messages, input]);
}
