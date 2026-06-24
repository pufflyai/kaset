import OpenAI from "openai";
import { task } from "../runtime";
import type { Tool } from "../tools/Tool";
import { toOpenAITools } from "../tools/toOpenAITools";
import type { AssistantMessage, BaseMessage } from "../utils/messageTypes";
import { consumeOpenAIStream } from "./consumeOpenAIStream";
import type { Model } from "./types";

type ChatCompletionTool = any;
type ChatCompletionMessageParam = any;

export type OpenAIToolDef = ChatCompletionTool;

export interface OpenAIModelOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  reasoning?: {
    effort: "minimal" | "low" | "medium" | "high";
  };
  dangerouslyAllowBrowser?: boolean;
  tools?: Array<Tool<any, any>>;
}

/** Create a model backed by the OpenAI (compatible) chat completions API. */
export function openaiModel(opts: OpenAIModelOptions): Model {
  const { model, apiKey, baseUrl, temperature, reasoning, tools, dangerouslyAllowBrowser } = opts;

  const openai = new OpenAI({
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    ...(dangerouslyAllowBrowser ? { dangerouslyAllowBrowser } : {}),
  });

  return task(
    "llm_chat",
    async function* (
      input: BaseMessage[] | { messages: BaseMessage[]; tools?: Array<Tool<any, any>>; sessionId?: string },
    ): AsyncGenerator<AssistantMessage, AssistantMessage, unknown> {
      const messages = Array.isArray(input) ? input : input.messages;
      const callTools = Array.isArray(input) ? [] : (input.tools ?? []);

      const toolDefs: ChatCompletionTool[] = [...toOpenAITools(tools ?? []), ...toOpenAITools(callTools)];

      const startedAt = Date.now();

      const stream = await openai.chat.completions.create({
        model,
        messages: messages as ChatCompletionMessageParam[],
        stream: true,
        // Ask OpenAI to include usage in the final stream event
        // See: https://platform.openai.com/docs/api-reference/streaming
        stream_options: { include_usage: true },
        ...(temperature !== undefined ? { temperature } : {}),
        ...(reasoning ? { reasoning_effort: reasoning.effort } : {}),
        ...(toolDefs.length ? { tools: toolDefs } : {}),
      });

      return yield* consumeOpenAIStream(stream as AsyncIterable<any>, startedAt);
    },
  );
}
