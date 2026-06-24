import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Hosts the WebLLM engine inside a Web Worker so WebGPU inference does not block
// the main thread. The worker is created by `createWebLLMWorker` in webllm.ts.
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
