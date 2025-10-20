import OpenAI from "openai";
import { task } from "../runtime";
import type { Tool } from "../tools/Tool";
import { toOpenAITools } from "../tools/toOpenAITools";
import type { AssistantMessage, BaseMessage, MessageContentPart } from "../utils/messageTypes";

type ChatCompletionTool = any;
type ChatCompletionMessageParam = any;

export type OpenAIToolDef = ChatCompletionTool;

export interface LLMTaskOptions {
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

export function createLLMTask(opts: LLMTaskOptions) {
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

      const assistant: AssistantMessage = { role: "assistant", content: "" };
      let contentParts: MessageContentPart[] | undefined;
      let textBuffer = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta ?? {};

        if (delta.content !== undefined) {
          if (Array.isArray(delta.content)) {
            const normalized = delta.content
              .map((part) => {
                if (!part || typeof part !== "object") return undefined;
                if (typeof part.type !== "string") return undefined;

                const clone: MessageContentPart = { ...part };
                if (clone.type === "text" && typeof clone.text !== "string") {
                  clone.text = clone.text == null ? "" : String(clone.text);
                }

                return clone;
              })
              .filter(Boolean) as MessageContentPart[];

            if (normalized.length) {
              if (!contentParts) {
                contentParts = textBuffer ? [{ type: "text", text: textBuffer }] : [];
                textBuffer = "";
              }

              for (const part of normalized) contentParts.push(part);
              assistant.content = contentParts;
            }
          } else {
            const chunkText =
              typeof delta.content === "string" ? delta.content : delta.content != null ? String(delta.content) : "";

            if (contentParts) {
              if (chunkText) {
                contentParts.push({ type: "text", text: chunkText });
                assistant.content = contentParts;
              }
            } else {
              textBuffer += chunkText;
              assistant.content = textBuffer;
            }
          }
        }

        if (delta.tool_calls) {
          if (!assistant.tool_calls) assistant.tool_calls = [];

          for (const callDelta of delta.tool_calls) {
            const idx = callDelta.index;
            let call = assistant.tool_calls[idx];
            if (!call) {
              call = {
                id: callDelta.id ?? "",
                type: "function",
                function: { name: "", arguments: "" },
              };
              assistant.tool_calls[idx] = call;
            }
            if (callDelta.id) call.id = callDelta.id;
            if (callDelta.type) call.type = callDelta.type;
            if (callDelta.function) {
              if (callDelta.function.name) call.function.name = callDelta.function.name;
              if (callDelta.function.arguments) {
                call.function.arguments += callDelta.function.arguments;
              }
            }
          }
        }

        // Capture usage if available at the end of the stream
        if (chunk.usage) {
          usage = {
            prompt_tokens: chunk.usage.prompt_tokens,
            completion_tokens: chunk.usage.completion_tokens,
            total_tokens: chunk.usage.total_tokens,
          };
        }

        const clone: AssistantMessage = {
          role: "assistant",
          content: Array.isArray(assistant.content)
            ? assistant.content.map((part) => ({ ...part }))
            : assistant.content,
          tool_calls: assistant.tool_calls?.map((c) => ({
            id: c.id,
            type: c.type,
            function: { ...c.function },
          })),
          durationMs: Date.now() - startedAt,
          ...(usage ? { usage } : {}),
        };

        yield clone;
      }

      const final: AssistantMessage = {
        role: "assistant",
        content: Array.isArray(assistant.content) ? assistant.content.map((part) => ({ ...part })) : assistant.content,
        tool_calls: assistant.tool_calls?.map((c) => ({
          id: c.id,
          type: c.type,
          function: { ...c.function },
        })),
        durationMs: Date.now() - startedAt,
        ...(usage ? { usage } : {}),
      };

      return final;
    },
  );
}
