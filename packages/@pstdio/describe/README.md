# describe-context

[![npm version](https://img.shields.io/npm/v/describe-context.svg?color=blue)](https://www.npmjs.com/package/describe-context)
[![license](https://img.shields.io/npm/l/describe-context)](https://github.com/pufflyai/core-utils/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/describe-context)](https://bundlephobia.com/package/describe-context)

Small utility to analyze a folder and generate a markdown context file suitable for LLMs. It exposes a reusable API and includes a simple CLI for local use.

## Installation

```sh
npm i describe-context
```

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
