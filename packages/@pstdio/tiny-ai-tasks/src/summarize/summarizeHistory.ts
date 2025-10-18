import type { Task } from "@pstdio/tiny-tasks";
import { prompt } from "@pstdio/prompt-utils";
import { task } from "../runtime";
import { createLLMTask } from "../llm/createLLMTask";
import type { ExtendedMessage } from "../messages/bus";
import type { BaseMessage } from "../utils/messageTypes";
import { messageContentToString } from "../utils/messageTypes";
import { roughCounter, type TokenCounter } from "./token";

export interface SummarizeOptions {
  /** Max tokens allowed for the whole history after compaction. */
  budget: number;
  /** Custom counter; defaults to roughCounter(). */
  counter?: TokenCounter;
  /** If true, marks synthesized summary message with meta.summary = true. */
  markSummary?: boolean;
}

/**
 * Deterministic, non-LLM truncation helper.
 * Keeps leading system messages, then greedily includes the newest messages
 * (from the end) until the budget is exceeded.
 */
export function truncateToBudget(
  history: ExtendedMessage[],
  opts: Pick<SummarizeOptions, "budget" | "counter">,
): ExtendedMessage[] {
  const counter = opts.counter ?? roughCounter();

  if (counter.count(history) <= opts.budget) return history;

  const pinned: ExtendedMessage[] = [];
  let firstNonSystemIdx = 0;
  for (; firstNonSystemIdx < history.length; firstNonSystemIdx++) {
    const m = history[firstNonSystemIdx];
    if (m.role === "system") pinned.push(m);
    else break;
  }

  const per = history.map((m) => counter.count([m]));
  const pinnedTokens = counter.count(pinned);
  const tokens = pinnedTokens;

  const keptTailIndices: number[] = [];
  let tailTokens = 0;

  for (let j = history.length - 1; j >= firstNonSystemIdx; j--) {
    const add = per[j];
    if (tokens + tailTokens + add <= opts.budget) {
      keptTailIndices.unshift(j);
      tailTokens += add;
    } else {
      break;
    }
  }

  const tail = keptTailIndices.map((i) => history[i]);
  return [...pinned, ...tail];
}

/**
 * Create a summarizer task that compresses older history to fit a token budget.
 * - If under budget → returns unchanged.
 * - If over budget → summarize the "middle" (older) slice into one `developer` message,
 *   then (if still needed) deterministically drop oldest tail messages.
 */
export function createSummarizer(
  callLLM: ReturnType<typeof createLLMTask>,
): Task<{ history: ExtendedMessage[]; opts: SummarizeOptions }, ExtendedMessage[]> {
  return task<{ history: ExtendedMessage[]; opts: SummarizeOptions }, ExtendedMessage[], ExtendedMessage[]>(
    "summarize_history",
    async function* ({
      history,
      opts,
    }: {
      history: ExtendedMessage[];
      opts: SummarizeOptions;
    }): AsyncGenerator<ExtendedMessage[], ExtendedMessage[], unknown> {
      const counter = opts.counter ?? roughCounter();
      const budget = Math.max(0, opts.budget);

      if (counter.count(history) <= budget) {
        yield history;
        return history;
      }

      const truncated = truncateToBudget(history, { budget, counter });

      let firstNonSystemIdx = 0;
      for (; firstNonSystemIdx < history.length; firstNonSystemIdx++) {
        if (history[firstNonSystemIdx].role !== "system") break;
      }

      const keptTailStartIdx = history.length - (truncated.length - firstNonSystemIdx);
      const middleToSummarize = history.slice(firstNonSystemIdx, Math.max(firstNonSystemIdx, keptTailStartIdx));

      if (middleToSummarize.length === 0) {
        yield truncated;
        return truncated;
      }

      const summarizePrompt: BaseMessage[] = [
        {
          role: "system",
          content: prompt`
            You are a summarizer. Summarize the following prior conversation chunk into a compact developer note.
            Preserve task goals, constraints, decisions, data fields/IDs, and tool outcomes. Do not invent facts.
            Avoid markdown headings.
          `,
        },
        ...middleToSummarize,
        { role: "user", content: "Provide a concise summary of the chunk above." },
      ];

      let summaryText = "";
      for await (const [assistantMsg] of callLLM(summarizePrompt)) {
        if (!assistantMsg) continue;
        const candidate = messageContentToString(assistantMsg.content);
        if (candidate) summaryText = candidate;
      }

      const summaryMsg: ExtendedMessage = {
        role: "developer",
        content: summaryText || "(summary unavailable)",
        meta: opts.markSummary ? { summary: true } : undefined,
      };

      const pinnedHead = history.slice(0, firstNonSystemIdx);
      const keptTail = history.slice(Math.max(firstNonSystemIdx, keptTailStartIdx));
      let compacted: ExtendedMessage[] = [...pinnedHead, summaryMsg, ...keptTail];

      if (counter.count(compacted) > budget) {
        compacted = truncateToBudget(compacted, { budget, counter });
      }

      yield compacted;
      return compacted;
    },
  );
}
