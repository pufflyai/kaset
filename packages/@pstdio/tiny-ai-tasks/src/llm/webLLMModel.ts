import { task } from "../runtime";
import type { Tool } from "../tools/Tool";
import { toOpenAITools } from "../tools/toOpenAITools";
import type { AssistantMessage, BaseMessage } from "../utils/messageTypes";
import { messageContentToString } from "../utils/messageTypes";
import { consumeOpenAIStream } from "./consumeOpenAIStream";
import type { Model } from "./types";
import { injectToolCallingPrompt, parseToolCalls, stripStreamingToolCalls } from "./webLLMToolCalling";

/**
 * WebLLM requires a single system message at the very front, while OpenAI
 * tolerates several (KAS sends one for its prompt and another for agents.md).
 * Merge all system messages into one leading message to satisfy WebLLM.
 */
function normalizeMessagesForWebLLM(messages: BaseMessage[]): BaseMessage[] {
  const systemTexts: string[] = [];
  const rest: BaseMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemTexts.push(messageContentToString(message.content));
    } else {
      rest.push(message);
    }
  }

  if (systemTexts.length === 0) return messages;
  // A single system message that is already first needs no change.
  if (systemTexts.length === 1 && messages[0]?.role === "system") return messages;

  return [{ role: "system", content: systemTexts.join("\n\n") }, ...rest];
}

type WebLLMEngine = {
  chat: { completions: { create: (req: any) => Promise<AsyncIterable<any>> } };
};

export interface WebLLMModelOptions {
  /** MLC model id, e.g. "gemma-4-E2B-it-q4f16_1-MLC". */
  model: string;
  /** WebLLM app config: `{ model_list: [{ model, model_id, model_lib, required_features }] }`. */
  appConfig?: any;
  /**
   * A Web Worker hosting `WebWorkerMLCEngineHandler`. When provided the engine
   * runs inside it (keeping WebGPU work off the main thread). The worker file
   * lives in the consuming app so its bundler can handle it. When omitted the
   * engine runs on the main thread.
   */
  worker?: Worker;
  /**
   * A pre-created MLC engine (or a promise resolving to one). Bypasses internal
   * engine creation — let the host app own the engine lifecycle (preloading,
   * readiness) and pass it in. Also useful for tests.
   */
  engine?: WebLLMEngine | Promise<WebLLMEngine>;
  /** Receives model download / compile progress while the engine initializes. */
  initProgressCallback?: (progress: any) => void;
  temperature?: number;
  tools?: Array<Tool<any, any>>;
}

/**
 * Create a model that runs fully in the browser via WebGPU using
 * `@mlc-ai/web-llm`. The package is imported lazily so it never enters the
 * static bundle of consumers that only use {@link openaiModel}.
 */
export function webLLMModel(opts: WebLLMModelOptions): Model {
  const { model, appConfig, worker, engine, initProgressCallback, temperature, tools } = opts;

  let enginePromise: Promise<WebLLMEngine> | undefined;

  const getEngine = (): Promise<WebLLMEngine> => {
    if (engine) return Promise.resolve(engine);

    if (!enginePromise) {
      enginePromise = (async () => {
        const webllm = await import("@mlc-ai/web-llm");
        const engineConfig = {
          ...(appConfig ? { appConfig } : {}),
          ...(initProgressCallback ? { initProgressCallback } : {}),
        };

        if (worker) {
          return webllm.CreateWebWorkerMLCEngine(worker, model, engineConfig) as unknown as WebLLMEngine;
        }

        return webllm.CreateMLCEngine(model, engineConfig) as unknown as WebLLMEngine;
      })();
    }

    return enginePromise;
  };

  return task(
    "webllm_chat",
    async function* (
      input: BaseMessage[] | { messages: BaseMessage[]; tools?: Array<Tool<any, any>>; sessionId?: string },
    ): AsyncGenerator<AssistantMessage, AssistantMessage, unknown> {
      const rawMessages = Array.isArray(input) ? input : input.messages;
      const callTools = Array.isArray(input) ? [] : (input.tools ?? []);

      const toolDefs = [...toOpenAITools(tools ?? []), ...toOpenAITools(callTools)];
      const useToolCalling = toolDefs.length > 0;

      // WebLLM gates its native `tools` parameter to an allowlist, so we never
      // pass it. With tools we inject a tool-calling prompt and parse the output.
      let messages = normalizeMessagesForWebLLM(rawMessages);
      if (useToolCalling) messages = injectToolCallingPrompt(messages, toolDefs);

      const resolvedEngine = await getEngine();
      const startedAt = Date.now();

      const stream = await resolvedEngine.chat.completions.create({
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(temperature !== undefined ? { temperature } : {}),
      });

      if (!useToolCalling) {
        return yield* consumeOpenAIStream(stream, startedAt);
      }

      // Stream output with tool-call markup hidden, then parse `<tool_call>`
      // blocks from the final message.
      const generator = consumeOpenAIStream(stream, startedAt);
      let step = await generator.next();
      while (!step.done) {
        const snapshot = step.value;
        const display =
          typeof snapshot.content === "string"
            ? { ...snapshot, content: stripStreamingToolCalls(snapshot.content) }
            : snapshot;

        yield display;
        step = await generator.next();
      }

      const finalRaw = step.value;
      const { content, toolCalls } = parseToolCalls(messageContentToString(finalRaw.content), String(startedAt));

      const final: AssistantMessage = {
        ...finalRaw,
        content,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      };

      yield final;
      return final;
    },
  );
}
