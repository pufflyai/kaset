import type { AssistantMessage, MessageContentPart } from "../utils/messageTypes";

/**
 * Consume an OpenAI-compatible chat completion stream and yield progressively
 * built `AssistantMessage` snapshots, returning the final message.
 *
 * The chunk shape is shared by the OpenAI SDK and `@mlc-ai/web-llm`, so both
 * model factories reuse this parser.
 */
export async function* consumeOpenAIStream(
  stream: AsyncIterable<any>,
  startedAt: number,
): AsyncGenerator<AssistantMessage, AssistantMessage, unknown> {
  const assistant: AssistantMessage = { role: "assistant", content: "" };
  let contentParts: MessageContentPart[] | undefined;
  let textBuffer = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta ?? {};

    if (delta.content !== undefined) {
      if (Array.isArray(delta.content)) {
        const normalized = delta.content
          .map((part: any) => {
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

    yield cloneAssistant(assistant, startedAt, usage);
  }

  return cloneAssistant(assistant, startedAt, usage);
}

function cloneAssistant(
  assistant: AssistantMessage,
  startedAt: number,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
): AssistantMessage {
  return {
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
}
