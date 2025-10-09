import { toMessageHistory } from "@pstdio/kas";
import type { Message } from "@/types";
import { roughCounter, type BaseMessage } from "@pstdio/tiny-ai-tasks";
import { useMemo } from "react";

export function calculateConversationTokens(messages: Message[], input: string) {
  const history = toMessageHistory(messages);
  const counter = roughCounter();

  let total = 0;
  let runningTokenTotal = 0;

  for (const message of history) {
    runningTokenTotal += counter.count([message]);
    if (message.role === "user") {
      total += runningTokenTotal;
    }
  }

  const trimmed = input.trim();
  if (trimmed) {
    const nextMessage = { role: "user", content: trimmed } as BaseMessage;
    runningTokenTotal += counter.count([nextMessage]);
    total += runningTokenTotal;
  }

  return total;
}

export function useEstimatedTokens(messages: Message[], input: string) {
  return useMemo(() => calculateConversationTokens(messages, input), [messages, input]);
}
