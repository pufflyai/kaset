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
    const summary = messages.reduce<TokenUsageSummary>(
      (acc, message) => {
        const usage = message.meta?.usage;
        if (!usage) return acc;

        if (message.role === "assistant") {
          acc.completionTokens += usage.completionTokens ?? 0;
          acc.totalTokens += usage.totalTokens ?? 0;
        }

        if (message.role === "user" || message.role === "developer") {
          acc.promptTokens += usage.promptTokens ?? 0;
        }

        return acc;
      },
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    );

    if (summary.totalTokens === 0) {
      const computedTotal = summary.promptTokens + summary.completionTokens;
      if (computedTotal > 0) {
        summary.totalTokens = computedTotal;
      }
    }

    if (summary.totalTokens > 0 || summary.promptTokens > 0 || summary.completionTokens > 0) {
      return summary;
    }

    const trimmed = input.trim();
    if (!trimmed) return summary;

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
