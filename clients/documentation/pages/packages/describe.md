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

Outputs markdown to stdout and basic stats to stderr.

## Notes

- Designed for developer tooling and LLM context preparation
- Keep folder sizes reasonable to avoid excessive output
