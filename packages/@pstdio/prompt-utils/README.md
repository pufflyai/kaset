## @pstdio/prompt-utils

Tiny utilities for building high-quality LLM prompts and working with JSON streams. Framework-agnostic, ESM-first.

### Install

```bash
npm i @pstdio/prompt-utils
```

### Quick start

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
// <INSTRUCTIONS>\nUse a friendly tone.\n\nHighlight issues, requests and next steps.\n</INSTRUCTIONS>

// Salvage a partial JSON stream (e.g., from an LLM)
parseJSONStream('{"a":1, "b": 2'); // -> { a: 1, b: 2 }
```

## API

### prompt (template tag)

Multiline prompt builder that:

- Strips common indentation
- Trims leading/trailing blank lines
- Collapses runs of 3+ blank lines to 2

```ts
const p = prompt`
	Title


	Line 1
		Line 2
`;
// "Title\n\nLine 1\n  Line 2"
```

### line (template tag)

Single-line builder that normalizes whitespace: collapses newlines and multiple spaces into single spaces, then trims.

```ts
line`  A\n multi-line   title  `; // -> "A multi-line title"
```

### listAnd(items, singleLine?) / listOr(items, singleLine?)

Natural-language list formatting using Oxford-style conjunctions.

```ts
listAnd(["A"]); // "A"
listAnd(["A", "B"]); // "A and B"
listAnd(["A", "B", "C"]); // "A, B and C"
listOr(["A", "B"]); // "A or B"
listAnd(["one", "two", "three"], true); // forced one line
```

### section(label, body)

Wrap content in labeled markers and preserve inner formatting.

```ts
section("CONTEXT", prompt`first\n\nsecond`);
// <CONTEXT>\nfirst\n\nsecond\n</CONTEXT>
```

### parseJSONStream(input)

Attempts to parse a possibly incomplete JSON stream. If parsing the full input fails, it tries progressively shorter prefixes and auto-closes unbalanced objects/arrays when possible. Returns the parsed value or null.

```ts
parseJSONStream('{"a":1, "b":2}'); // { a: 1, b: 2 }
parseJSONStream("[1,2,3"); // [1, 2, 3]
parseJSONStream(""); // null
```

### getSchema(input)

Derive a simple JSON-like schema from any JS value.

Types used: "object", "array", "string", "number", "boolean", "null", and fallback "any".

```ts
getSchema({ a: 1, b: ["x"], c: { d: true } });
// {
//   type: "object",
//   properties: {
//     a: { type: "number" },
//     b: { type: "array", items: { type: "string" } },
//     c: { type: "object", properties: { d: { type: "boolean" } } }
//   }
// }
```

### safeParse<T = object>(str)

JSON.parse wrapper that returns the parsed value on success, otherwise returns the original string.

```ts
safeParse('{"ok":true}'); // { ok: true }
safeParse("oops"); // "oops"
```

### safeStringify(obj)

Stable stringify with useful normalization:

- Deterministic key order (json-stable-stringify)
- BigInt values are converted to Number
- Numeric-looking strings are emitted as numbers (e.g., "\"42\"" -> 42)

```ts
safeStringify({ b: 2, a: 1n, x: "007" }); // '{"a":1,"b":2,"x":7}'
```

### hashString(str)

Fast FNV-1a 32-bit hash as lowercase hex.

```ts
hashString("hello"); // e.g., "4f9f2cab"
```

### shortUID(prefix = "r")

Short, LLM-friendly ID using a restricted alphabet, 6 chars long (plus optional prefix).

```ts
shortUID(); // "rabc123"-style
shortUID("t-"); // "t-xyz789"-style
```

## TypeScript and ESM

This package is ESM. Import using `import ... from` in Node ESM or bundlers.

## License

MIT © Pufflig AB
