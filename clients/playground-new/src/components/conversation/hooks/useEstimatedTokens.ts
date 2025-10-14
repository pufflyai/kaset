import { toMessageHistory } from "@pstdio/kas";
import type { Message } from "@/types";
import { roughCounter, type BaseMessage } from "@pstdio/tiny-ai-tasks";
import { useMemo } from "react";

export interface TokenUsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  conversationPromptTokens: number;
  conversationTotalTokens: number;
}

type RunUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
};

const ensureRun = (run: RunUsage | null): RunUsage => {
  if (run) return run;
  return { promptTokens: 0, completionTokens: 0 };
};

const getRunTotal = (run: RunUsage): number => {
  const prompt = run.promptTokens;
  const completion = run.completionTokens;
  if (run.totalTokens !== undefined) {
    return run.totalTokens;
  }
  return prompt + completion;
};

export function useEstimatedTokens(messages: Message[], input: string): TokenUsageSummary {
  return useMemo(() => {
    const runs: RunUsage[] = [];
    let currentRun: RunUsage | null = null;

    for (const message of messages) {
      const usage = message.meta?.usage;
      if (!usage) continue;

      if (message.role === "user" || message.role === "developer") {
        currentRun = ensureRun(currentRun);
        if (usage.promptTokens !== undefined) {
          currentRun.promptTokens = Math.max(currentRun.promptTokens, usage.promptTokens);
        }
        if (usage.totalTokens !== undefined) {
          currentRun.totalTokens = Math.max(currentRun.totalTokens ?? 0, usage.totalTokens);
        }
      }

      if (message.role === "assistant") {
        currentRun = ensureRun(currentRun);
        if (usage.promptTokens !== undefined) {
          currentRun.promptTokens = Math.max(currentRun.promptTokens, usage.promptTokens);
        }
        if (usage.completionTokens !== undefined) {
          currentRun.completionTokens = Math.max(currentRun.completionTokens, usage.completionTokens);
        }
        if (usage.totalTokens !== undefined) {
          currentRun.totalTokens = Math.max(currentRun.totalTokens ?? 0, usage.totalTokens);
        }

        runs.push(currentRun);
        currentRun = null;
      }
    }

    if (runs.length > 0) {
      const promptTokens = runs.reduce((sum, run) => sum + run.promptTokens, 0);
      const completionTokens = runs.reduce((sum, run) => sum + run.completionTokens, 0);
      const totalTokens = runs.reduce((sum, run) => sum + getRunTotal(run), 0);
      const lastRun = runs[runs.length - 1];

      let conversationPromptTokens = lastRun.promptTokens;
      let conversationTotalTokens = getRunTotal(lastRun);

      const trimmed = input.trim();
      if (trimmed) {
        const history = toMessageHistory(messages);
        const withCurrent: BaseMessage[] = [...history, { role: "user", content: trimmed } as BaseMessage];

        const counter = roughCounter();
        const estimatedPromptTokens = counter.count(withCurrent);
        conversationPromptTokens = estimatedPromptTokens;
        conversationTotalTokens = estimatedPromptTokens;
      }

      return {
        promptTokens,
        completionTokens,
        totalTokens,
        conversationPromptTokens,
        conversationTotalTokens,
      } satisfies TokenUsageSummary;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        conversationPromptTokens: 0,
        conversationTotalTokens: 0,
      } satisfies TokenUsageSummary;
    }

    const history = toMessageHistory(messages);
    const withCurrent: BaseMessage[] = [...history, { role: "user", content: trimmed } as BaseMessage];

    const counter = roughCounter();
    const estimatedPromptTokens = counter.count(withCurrent);

    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      conversationPromptTokens: estimatedPromptTokens,
      conversationTotalTokens: estimatedPromptTokens,
    } satisfies TokenUsageSummary;
  }, [messages, input]);
}
