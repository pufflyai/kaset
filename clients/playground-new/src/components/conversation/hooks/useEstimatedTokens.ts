import { toMessageHistory } from "@pstdio/kas";
import type { Message } from "@/types";
import { roughCounter, type BaseMessage, type TokenCounter } from "@pstdio/tiny-ai-tasks";
import { useMemo, useRef } from "react";

interface ConversationTokenCache {
  counter: TokenCounter;
  historySignatures: string[];
  runningTotals: number[];
  userContributionTotals: number[];
  singleMessageBuffer: BaseMessage[];
}

function createTokenCache(): ConversationTokenCache {
  return {
    counter: roughCounter(),
    historySignatures: [],
    runningTotals: [],
    userContributionTotals: [],
    singleMessageBuffer: new Array<BaseMessage>(1),
  };
}

function getMessageSignature(message: BaseMessage) {
  return JSON.stringify(message);
}

function countTokensForMessage(counter: TokenCounter, buffer: BaseMessage[], message: BaseMessage) {
  buffer[0] = message;
  const total = counter.count(buffer);
  buffer.length = 0;
  return total;
}

export function calculateConversationTokens(
  messages: Message[],
  input: string,
  cache: ConversationTokenCache = createTokenCache(),
) {
  const history = toMessageHistory(messages);

  const { counter, historySignatures, runningTotals, userContributionTotals, singleMessageBuffer } = cache;

  const historyLength = history.length;

  let prefixLength = 0;
  const maxPrefix = Math.min(historyLength, historySignatures.length);
  while (prefixLength < maxPrefix) {
    const signature = getMessageSignature(history[prefixLength]);
    if (historySignatures[prefixLength] !== signature) break;
    prefixLength += 1;
  }

  let runningTokenTotal = prefixLength > 0 ? runningTotals[prefixLength - 1] : 0;
  let total = prefixLength > 0 ? userContributionTotals[prefixLength - 1] : 0;

  for (let index = prefixLength; index < historyLength; index += 1) {
    const message = history[index];
    const signature = getMessageSignature(message);
    historySignatures[index] = signature;

    const messageTokens = countTokensForMessage(counter, singleMessageBuffer, message);

    runningTokenTotal += messageTokens;
    runningTotals[index] = runningTokenTotal;

    if (message.role === "user") {
      total += runningTokenTotal;
    }

    userContributionTotals[index] = total;
  }

  historySignatures.length = historyLength;
  runningTotals.length = historyLength;
  userContributionTotals.length = historyLength;

  const trimmed = input.trim();

  let finalTotal = historyLength > 0 ? userContributionTotals[historyLength - 1] : 0;
  const baseRunningTotal = historyLength > 0 ? runningTotals[historyLength - 1] : 0;

  if (trimmed) {
    const nextMessage = { role: "user", content: trimmed } as BaseMessage;
    const nextTokens = countTokensForMessage(counter, singleMessageBuffer, nextMessage);
    finalTotal += baseRunningTotal + nextTokens;
  }

  return finalTotal;
}

export function useEstimatedTokens(messages: Message[], input: string) {
  const cacheRef = useRef<ConversationTokenCache | null>(null);

  if (!cacheRef.current) {
    cacheRef.current = createTokenCache();
  }

  return useMemo(() => calculateConversationTokens(messages, input, cacheRef.current!), [messages, input]);
}
