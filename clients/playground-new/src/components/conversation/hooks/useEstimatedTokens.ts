import { toMessageHistory } from "@pstdio/kas";
import type { Message } from "@/types";
import { roughCounter, type BaseMessage } from "@pstdio/tiny-ai-tasks";
import { useMemo } from "react";

export interface TokenUsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export function useEstimatedTokens(messages: Message[], input: string): TokenUsageSummary {
  return useMemo(() => {
    const aggregate = messages.reduce(
      (acc, message) => {
        const usage = message.meta?.usage;
        if (!usage) return acc;

        if (message.role === "assistant") {
          acc.completionTokens += usage.completionTokens ?? 0;
          if (usage.totalTokens !== undefined) {
            acc.assistantTotalTokens += usage.totalTokens;
          }
        }

        if (message.role === "user" || message.role === "developer") {
          acc.promptTokens += usage.promptTokens ?? 0;
        }

        return acc;
      },
      { promptTokens: 0, completionTokens: 0, assistantTotalTokens: 0 },
    );

    const aggregateTotal = aggregate.promptTokens + aggregate.completionTokens;
    const totalTokens = Math.max(aggregate.assistantTotalTokens, aggregateTotal);

    if (totalTokens > 0 || aggregate.promptTokens > 0 || aggregate.completionTokens > 0) {
      return {
        promptTokens: aggregate.promptTokens,
        completionTokens: aggregate.completionTokens,
        totalTokens,
      } satisfies TokenUsageSummary;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0 } satisfies TokenUsageSummary;
    }

    const history = toMessageHistory(messages);
    const withCurrent: BaseMessage[] = [...history, { role: "user", content: trimmed } as BaseMessage];

    const counter = roughCounter();
    const estimatedTotal = counter.count(withCurrent);

    return {
      promptTokens: estimatedTotal,
      completionTokens: 0,
      totalTokens: estimatedTotal,
    } satisfies TokenUsageSummary;
  }, [messages, input]);
}
