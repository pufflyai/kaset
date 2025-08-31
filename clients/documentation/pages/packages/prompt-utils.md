---
title: "@pstdio/prompt-utils"
---

# @pstdio/prompt-utils

Tiny utilities for building high-quality LLM prompts and working with JSON streams.

## Install

```bash
npm i @pstdio/prompt-utils
```

## Quick start

```ts
import { prompt, line, listAnd, section, parseJSONStream } from "@pstdio/prompt-utils";

const title = line`
  Summarize the following
  customer emails
`;

const body = prompt`
  Use a friendly tone.

  Highlight ${listAnd(["issues", "requests", "next steps"])}.
`;

const content = section("INSTRUCTIONS", body);
// <INSTRUCTIONS>...</INSTRUCTIONS>

parseJSONStream('{"a":1, "b": 2');
```

## API (concise)

- prompt (template tag): multiline builder that strips common indent, trims outer blank lines, and collapses 3+ blank lines to 2
- line (template tag): single-line builder that collapses whitespace/newlines
- listAnd / listOr: Oxford-style list joiners; optional singleLine
- section(label, body): wraps content with `<LABEL>` blocks preserving inner formatting
- parseJSONStream(input): attempts to recover from incomplete streams; returns parsed value or null
- getSchema(value): derive a simple JSON-like schema from any JS value
- `safeParse<T>(str)`: JSON.parse that falls back to the original string
- `safeStringify(obj)`: stable stringify with BigInt and numeric-string normalization
- `hashString(str)`: fast fnv1a 32-bit hex hash
- `shortUID(prefix?)`: short, LLM-friendly ID

ESM and TypeScript-friendly; see the package README for full signatures.
