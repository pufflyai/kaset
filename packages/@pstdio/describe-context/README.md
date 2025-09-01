# describe-context

[![npm version](https://img.shields.io/npm/v/describe-context.svg?color=blue)](https://www.npmjs.com/package/describe-context)
[![license](https://img.shields.io/npm/l/describe-context)](https://github.com/pufflyai/core-utils/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/describe-context)](https://bundlephobia.com/package/describe-context)

Analyze a folder and generate a compact Markdown "context" for LLM prompts, code reviews, and summaries. Includes a simple CLI and a small, reusable API.

For additional information, please refer to the [documentation](https://pufflyai.github.io/core-utils/packages/describe).

## Quick Start

### Installation

```bash
npm i describe-context
```

### Usage

```ts
import { generateContext } from "describe-context";

const { markdown } = await generateContext(".");
```

## Notes & limitations

- Token counts are rough estimates and very large folders may be truncated.

## Contributing

See the [monorepo README](https://github.com/pufflyai/core-utils#readme) for contribution guidelines.

## License

MIT © Pufflig AB
