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

See API details in the package README.
