# @pstdio/prompt-utils

[![npm version](https://img.shields.io/npm/v/@pstdio/prompt-utils.svg?color=blue)](https://www.npmjs.com/package/@pstdio/prompt-utils)
[![license](https://img.shields.io/npm/l/@pstdio/prompt-utils)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fprompt-utils)](https://bundlephobia.com/package/%40pstdio%2Fprompt-utils)

Tiny helpers for building prompts and working with JSON streams.

For additional information, please refer to the [documentation](https://kaset.dev/packages/prompt-utils).

## Quick Start

### Installation

```bash
npm i @pstdio/prompt-utils
```

### Usage

```ts
import { prompt } from "@pstdio/prompt-utils";

const p = prompt`Hello ${"world"}`;
```

## Notes & limitations

- ESM-only; use `import` syntax.

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
