# @pstdio/tiny-ai-tasks

## 0.3.0

### Minor Changes

- 0bb6060: Add a provider-agnostic `Model` type and two model factories. `openaiModel` replaces `createLLMTask` (kept as a deprecated alias) and `webLLMModel` runs models fully in the browser via WebGPU using `@mlc-ai/web-llm` (an optional peer dependency). A model-agnostic tool-calling shim lets tools work on models outside WebLLM's built-in function-calling allowlist.
