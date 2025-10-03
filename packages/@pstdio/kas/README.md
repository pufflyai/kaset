# @pstdio/kas

[![npm version](https://img.shields.io/npm/v/@pstdio/kas.svg?color=blue)](https://www.npmjs.com/package/@pstdio/kas)
[![license](https://img.shields.io/npm/l/@pstdio/kas)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fkas)](https://bundlephobia.com/package/%40pstdio%2Fkas)

A simple coding agent for the browser. Works entirely client‑side with an OPFS workspace and approval‑gated writes.

For additional information, please refer to the [documentation](https://pufflyai.github.io/kaset/packages/kas).

## Quick Start

### Installation

```bash
npm i @pstdio/kas
```

### Usage

```ts
import { createKasAgent } from "@pstdio/kas";

const workspaceDir = "/projects/demo";

const OPFSTools = createOpfsTools({
  workspaceDir,
  // Optional: customize which tools require approval
  approvalGatedTools: ["opfs_write_file"],
  // Require permission before the approval gated tool in this workspace
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    console.log("Needs approval", tool, workspaceDir, detail);
    return confirm(`Allow ${tool} in ${workspaceDir}?`);
  },
});

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "<YOUR_API_KEY>",
  tools: [...OPFSTools],
});

// Run agent with messages
const messages = [{ role: "user", content: "Create a simple React component" }];
for await (const response of agent(messages)) {
  console.log(response);
}
```

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
