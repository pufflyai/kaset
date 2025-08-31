# describe-context

[![npm version](https://img.shields.io/npm/v/describe-context.svg?color=blue)](https://www.npmjs.com/package/describe-context)
[![license](https://img.shields.io/npm/l/describe-context)](https://github.com/pufflyai/core-utils/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/describe-context)](https://bundlephobia.com/package/describe-context)

Small utility to analyze a folder and generate a markdown context file suitable for LLMs or code review. It exposes a reusable API and includes a simple CLI entry script for local use.

## Install

- Workspace package; built via the monorepo: `npm run build` at root.

## Usage (Library)

```ts
import { generateContext } from "describe-context";

const { markdown, stats } = await generateContext("/path/to/folder");
console.log(markdown);
console.log(stats);
```

## Usage (CLI)

After building this package (`npm run build` in the repo root), run the compiled CLI directly with Node:

```
npx describe-context <folder>
```

## Build

- From repo root: `npm run build`
- Package only: `npm run build --workspace @pstdio/describe-context`
