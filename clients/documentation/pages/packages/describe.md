---
title: describe-context
---

# describe-context

Analyze a folder and generate a markdown context suitable for LLMs or code review. Exposes a reusable API and a simple CLI.

## Install

This package is part of the monorepo. Build via the repo root.

## Usage (Library)

```ts
import { generateContext } from "describe-context";

const { markdown, stats } = await generateContext("/path/to/folder");
console.log(markdown);
console.log(stats);
```

## Usage (CLI)

After building this package (`npm run build` in the repo root), run:

```
npx describe-context <folder>
```
