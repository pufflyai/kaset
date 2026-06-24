/**
 * WebLLM (in-browser WebGPU) configuration for the playground.
 *
 * The model runs entirely in the browser — no API key, no network round-trip
 * after the model weights are downloaded and cached.
 *
 * The app owns the engine lifecycle (creation, preloading, readiness) and hands
 * the engine to `webLLMModel`. That way the UI can preload the model and observe
 * exactly when it has finished loading.
 */

import { type Model, webLLMModel } from "@pstdio/kas";
import { useWebLLMStore } from "./webllmStore";

export const DEFAULT_WEBLLM_MODEL_ID = "gemma-4-E2B-it-q4f16_1-MLC";

const GEMMA_REPO = "https://huggingface.co/welcoma/gemma-4-E2B-it-q4f16_1-MLC";

/** WebLLM app config exposing the Gemma MLC build to the engine. */
export const WEBLLM_APP_CONFIG = {
  // Cache weights/wasm in IndexedDB rather than the Cache API. The Cache API's
  // Cache.add() rejects HuggingFace's cross-origin Xet CDN redirects with a
  // "network error"; IndexedDB stores the fetched bytes directly and avoids it.
  cacheBackend: "indexeddb",
  model_list: [
    {
      model: GEMMA_REPO,
      model_id: DEFAULT_WEBLLM_MODEL_ID,
      model_lib: `${GEMMA_REPO}/resolve/main/libs/gemma-4-E2B-it-q4f16_1-MLC-webgpu.wasm`,
      required_features: ["shader-f16"],
      // This converted model ships both context_window_size and sliding_window_size
      // set; WebLLM requires exactly one. Disable the sliding window to use the full
      // 4096-token context (matches WebLLM's own prebuilt overrides).
      overrides: {
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    },
  ],
};

/** Returns true when the browser exposes WebGPU (required by WebLLM). */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/** Create the Web Worker that hosts the WebLLM engine, keeping WebGPU off the main thread. */
function createWebLLMWorker(): Worker {
  return new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
}

type WebLLMEngine = { chat: { completions: { create: (req: any) => Promise<AsyncIterable<any>> } } };

let cachedEngine: { id: string; engine: Promise<WebLLMEngine> } | undefined;

/**
 * Get (or start creating) the WebLLM engine for a model id. The engine downloads
 * and compiles the model on first use; the returned promise resolves only once
 * the model is fully loaded. Memoized so the worker, engine, and cached weights
 * are reused across messages.
 */
export function ensureWebLLMEngine(modelId: string): Promise<WebLLMEngine> {
  if (cachedEngine?.id === modelId) return cachedEngine.engine;

  const store = useWebLLMStore.getState();
  store.set({ loading: true, ready: false, progress: 0, text: "", error: undefined });

  const engine = (async () => {
    const webllm = await import("@mlc-ai/web-llm");
    const worker = createWebLLMWorker();

    return webllm.CreateWebWorkerMLCEngine(worker, modelId, {
      appConfig: WEBLLM_APP_CONFIG as any,
      initProgressCallback: (report: { progress?: number; text?: string }) => {
        const progress = report.progress ?? 0;
        useWebLLMStore.getState().set({
          loading: progress < 1,
          progress,
          text: report.text ?? "",
          ready: progress >= 1,
          error: undefined,
        });
      },
    }) as unknown as Promise<WebLLMEngine>;
  })();

  // Surface a fully-loaded / failed terminal state independent of progress events.
  engine.then(
    () => useWebLLMStore.getState().set({ loading: false, ready: true, progress: 1 }),
    (err) => {
      cachedEngine = undefined;
      useWebLLMStore.getState().set({ loading: false, ready: false, error: String(err?.message ?? err) });
    },
  );

  cachedEngine = { id: modelId, engine };
  return engine;
}

/**
 * Preload the model so the UI can show progress and know when it is ready.
 * Resolves once the model is fully loaded; rejects if loading fails.
 */
export async function preloadWebLLMModel(modelId: string): Promise<void> {
  await ensureWebLLMEngine(modelId);
}

/** Build the agent model, backed by the (preloaded or lazily created) engine. */
export function getWebLLMModel(modelId: string): Model {
  return webLLMModel({ model: modelId, engine: ensureWebLLMEngine(modelId) });
}
