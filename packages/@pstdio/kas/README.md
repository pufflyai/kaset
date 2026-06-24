# @pstdio/kas

[![npm version](https://img.shields.io/npm/v/@pstdio/kas.svg?color=blue)](https://www.npmjs.com/package/@pstdio/kas)
[![license](https://img.shields.io/npm/l/@pstdio/kas)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fkas)](https://bundlephobia.com/package/%40pstdio%2Fkas)

A simple coding agent for the browser. Works entirely client‑side with an OPFS workspace and approval‑gated writes.

For additional information, please refer to the [documentation](https://kaset.dev/packages/kas).

## Quick Start

### Installation

```bash
npm i @pstdio/kas
```

### Usage

```ts
import { createOpfsTools } from "@pstdio/kas/opfs-tools";
import { createKasAgent, createApprovalGate, openaiModel } from "@pstdio/kas";

const rootDir = "/projects/demo";

const OPFSTools = createOpfsTools({
  rootDir,
  approvalGate: createApprovalGate({
    // Optional: customize which tools require approval
    approvalGatedTools: ["opfs_write_file"],
    // Optional: Require permission before the approval gated tool in this workspace
    requestApproval: async ({ tool, workspaceDir, detail }) => {
      console.log("Needs approval", tool, workspaceDir, detail);
      return window.confirm(`Allow ${tool} in ${workspaceDir}?`);
    },
  }),
});

// Build a model, then hand it to the agent.
const model = openaiModel({
  model: "gpt-5-mini",
  apiKey: "<YOUR_API_KEY>",
});

const agent = createKasAgent({
  model,
  tools: [...OPFSTools],
});

// Run agent with messages
const messages = [{ role: "user", content: "Create a simple React component" }];
for await (const response of agent(messages)) {
  console.log(response);
}
```

### Running models in the browser with WebLLM

`webLLMModel` runs a model fully in the browser via WebGPU using
[`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm) — no API key and no network
round-trip after the weights are downloaded. Install `@mlc-ai/web-llm` (a peer
dependency) alongside `@pstdio/kas`.

```ts
import { createKasAgent, webLLMModel } from "@pstdio/kas";

const repo = "https://huggingface.co/welcoma/gemma-4-E2B-it-q4f16_1-MLC";

const model = webLLMModel({
  model: "gemma-4-E2B-it-q4f16_1-MLC",
  appConfig: {
    model_list: [
      {
        model: repo,
        model_id: "gemma-4-E2B-it-q4f16_1-MLC",
        model_lib: `${repo}/resolve/main/libs/gemma-4-E2B-it-q4f16_1-MLC-webgpu.wasm`,
        required_features: ["shader-f16"],
      },
    ],
  },
  // Optional: run the engine in a Web Worker (your app bundles the worker file).
  // worker: new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" }),
  initProgressCallback: (report) => console.log(report.text),
});

const agent = createKasAgent({ model, tools: [...OPFSTools] });
```

> **Note:** WebLLM requires a WebGPU-capable browser, and tool calling depends on
> the chosen model. Pick an MLC build with strong function-calling support for
> agentic use.

With UI adapters

```ts
import { loadAgentInstructions } from "@pstdio/kas/opfs-utils";
import { toConversationUI } from "@pstdio/kas/kas-ui";

const messages = [{ role: "user", content: "Create a simple React component" }];

for await (const response of toConversationUI(agent(messages))) {
  console.log(response);
}
```

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
