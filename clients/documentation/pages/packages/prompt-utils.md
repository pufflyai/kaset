---
title: "@pstdio/prompt-utils"
---

# @pstdio/prompt-utils

Tiny utilities for building high-quality LLM prompts and working with JSON streams. This package provides a comprehensive set of tools for creating well-formatted prompts, handling incomplete JSON data, and working with various data transformations commonly needed in LLM workflows.

## Install

```bash
npm i @pstdio/prompt-utils
```

## Overview

The `@pstdio/prompt-utils` package consists of three main categories of utilities:

- **Template Functions**: For building clean, well-formatted prompts
- **JSON Utilities**: For handling streaming and partial JSON data
- **Helper Utilities**: For common data processing tasks

## Template Functions

These utilities help you build clean, properly formatted prompts with consistent indentation and spacing.

### `prompt`

A template tag for creating multiline prompts with automatic indentation cleanup.

**Features:**

- Strips common indentation from all lines
- Trims outer blank lines
- Collapses 3+ consecutive blank lines into 2
- Preserves relative indentation within the content

```ts
import { prompt } from "@pstdio/prompt-utils";

const instructions = prompt`
  You are a helpful assistant.
  
  Please follow these guidelines:
    - Be concise and clear
    - Provide examples when helpful
  
  
  
  Always maintain a professional tone.
`;

console.log(instructions);
// Output:
// You are a helpful assistant.
//
// Please follow these guidelines:
//   - Be concise and clear
//   - Provide examples when helpful
//
// Always maintain a professional tone.
```

**Variable Interpolation:**

```ts
const topic = "machine learning";
const complexity = "beginner";

const prompt = prompt`
  Explain ${topic} concepts for a ${complexity} audience.
  
  Use simple examples and avoid jargon.
`;
```

### `line`

A template tag for creating single-line content by normalizing whitespace and newlines.

```ts
import { line } from "@pstdio/prompt-utils";

const title = line`
  Summarize the following
  customer   feedback    and
  identify key themes
`;

console.log(title);
// Output: "Summarize the following customer feedback and identify key themes"
```

### `listAnd` and `listOr`

Oxford-style list joiners for creating natural language lists.

```ts
import { listAnd, listOr } from "@pstdio/prompt-utils";

// listAnd examples
console.log(listAnd(["apple"])); // "apple"
console.log(listAnd(["apple", "banana"])); // "apple and banana"
console.log(listAnd(["apple", "banana", "cherry"])); // "apple, banana and cherry"

// listOr examples
console.log(listOr(["red", "green", "blue"])); // "red, green or blue"

// Single line option for multi-line templates
const items = ["task A", "task B", "task C"];
const instruction = prompt`
  Complete ${listAnd(items, true)} before proceeding.
  
  Each task should be done carefully.
`;
```

### `section`

Wraps content in labeled XML-like tags while preserving inner formatting.

```ts
import { section, prompt } from "@pstdio/prompt-utils";

const context = prompt`
  The user is asking about TypeScript.
  They are a beginner programmer.
`;

const instructions = prompt`
  Provide a clear explanation.
  Use simple examples.
`;

const fullPrompt = prompt`
  ${section("CONTEXT", context)}
  
  ${section("INSTRUCTIONS", instructions)}
`;

console.log(fullPrompt);
// Output:
// <CONTEXT>
// The user is asking about TypeScript.
// They are a beginner programmer.
// </CONTEXT>
//
// <INSTRUCTIONS>
// Provide a clear explanation.
// Use simple examples.
// </INSTRUCTIONS>
```

## JSON Utilities

These utilities help handle JSON data, especially in streaming scenarios where data might be incomplete.

### `parseJSONStream`

Attempts to parse potentially incomplete JSON streams by trying progressively shorter prefixes and auto-closing unclosed structures.

```ts
import { parseJSONStream } from "@pstdio/prompt-utils";

// Complete JSON - works normally
parseJSONStream('{"name": "John", "age": 30}');
// Returns: { name: "John", age: 30 }

// Incomplete object - salvages valid parts
parseJSONStream('{"name": "John", "age": 30, "email"');
// Returns: { name: "John", age: 30 }

// Incomplete nested object
parseJSONStream('{"user": {"id": 123, "name": "John"');
// Returns: { user: { id: 123 } }

// Incomplete array
parseJSONStream("[1, 2, 3,");
// Returns: [1, 2, 3]

// Invalid JSON
parseJSONStream("not valid json");
// Returns: null

// Empty string
parseJSONStream("");
// Returns: null
```

**Use Cases:**

- Processing streaming LLM responses that output JSON
- Handling network timeouts during JSON transfer
- Debugging partial JSON data

### `getSchema`

Generates a simple JSON-like schema from any JavaScript value.

```ts
import { getSchema } from "@pstdio/prompt-utils";

// Primitive types
getSchema("hello"); // { type: "string" }
getSchema(42); // { type: "number" }
getSchema(true); // { type: "boolean" }
getSchema(null); // { type: "null" }

// Arrays
getSchema([1, 2, 3]);
// { type: "array", items: { type: "number" } }

getSchema([]);
// { type: "array", items: { type: "any" } }

// Objects
getSchema({
  name: "John",
  age: 30,
  active: true,
});
// {
//   type: "object",
//   properties: {
//     name: { type: "string" },
//     age: { type: "number" },
//     active: { type: "boolean" }
//   }
// }

// Complex nested structures
getSchema({
  users: [{ id: 1, name: "Alice", tags: ["admin", "active"] }],
});
// {
//   type: "object",
//   properties: {
//     users: {
//       type: "array",
//       items: {
//         type: "object",
//         properties: {
//           id: { type: "number" },
//           name: { type: "string" },
//           tags: { type: "array", items: { type: "string" } }
//         }
//       }
//     }
//   }
// }
```

### `safeParse`

JSON.parse that gracefully falls back to the original string on failure.

```ts
import { safeParse } from "@pstdio/prompt-utils";

// Valid JSON
safeParse<{ name: string }>('{"name": "John"}');
// Returns: { name: "John" }

// Invalid JSON - returns original string
safeParse("not json");
// Returns: "not json"

// TypeScript support
interface User {
  id: number;
  name: string;
}

const result = safeParse<User>('{"id": 123, "name": "Alice"}');
// Type: User | string
```

### `safeStringify`

Stable JSON stringification with BigInt support and numeric string normalization.

```ts
import { safeStringify } from "@pstdio/prompt-utils";

const data = {
  id: BigInt(123456789012345),
  count: "42", // String that looks like a number
  name: "test",
  quote: 'He said "hello"',
};

safeStringify(data);
// Returns consistent string representation
// BigInts converted to numbers
// Numeric strings converted to numbers
// Quotes handled safely
```

## Helper Utilities

### `hashString`

Fast FNV-1a 32-bit hash function that works in both browser and Node.js.

```ts
import { hashString } from "@pstdio/prompt-utils";

await hashString("hello world");
// Returns: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"

await hashString("different input");
```

**Use Cases:**

- Creating cache keys
- Generating deterministic IDs
- Content deduplication

### `shortUID`

Generates short, LLM-friendly unique identifiers.

```ts
import { shortUID } from "@pstdio/prompt-utils";

shortUID();
// Returns: "r4k2m8" (6 random chars with default "r" prefix)

shortUID("task");
// Returns: "task7n3x1q"

shortUID("user");
// Returns: "user9m4k2p"
```

**Features:**

- Uses LLM-friendly alphabet (no confusing characters like 0/O, 1/l)
- Short length (6 characters + prefix)
- Customizable prefix for categorization

## Real-World Examples

### Building Complex Prompts

```ts
import { prompt, section, listAnd } from "@pstdio/prompt-utils";

function createCodeReviewPrompt(language: string, concerns: string[], codeSnippet: string) {
  const context = prompt`
    Language: ${language}
    Review Focus: ${listAnd(concerns)}
  `;

  const instructions = prompt`
    1. Analyze the code for the specified concerns
    2. Provide specific, actionable feedback
    3. Suggest improvements with examples
    4. Rate overall code quality (1-10)
  `;

  const code = section("CODE", codeSnippet);

  return prompt`
    ${section("CONTEXT", context)}
    
    ${section("INSTRUCTIONS", instructions)}
    
    ${code}
  `;
}

const reviewPrompt = createCodeReviewPrompt(
  "TypeScript",
  ["performance", "security", "maintainability"],
  `
    function processUser(data: any) {
      return data.users.map(u => u.name.toUpperCase());
    }
  `,
);
```

### Processing Streaming JSON from LLMs

```ts
import { parseJSONStream } from "@pstdio/prompt-utils";

// Simulate processing a streaming response
function processStreamingResponse(chunks: string[]) {
  let accumulated = "";

  for (const chunk of chunks) {
    accumulated += chunk;

    // Try to parse the current accumulated data
    const parsed = parseJSONStream(accumulated);
    if (parsed) {
      console.log("Successfully parsed:", parsed);
      // Process the valid JSON...
    }
  }
}

// Example chunks from streaming response
processStreamingResponse([
  '{"analysis": {',
  '"sentiment": "positive",',
  '"confidence": 0.8',
  // Stream might end abruptly here
]);
```

### Schema-Driven Validation

```ts
import { getSchema, safeStringify } from "@pstdio/prompt-utils";

function validateAndDescribeData(data: unknown) {
  const schema = getSchema(data);

  return {
    data: safeStringify(data),
    schema: safeStringify(schema),
    summary: `Data contains ${schema.type} with ${
      schema.properties
        ? Object.keys(schema.properties).length + " properties"
        : schema.items
          ? "items of type " + schema.items.type
          : "primitive value"
    }`,
  };
}
```

## Best Practices

### Template Functions

- Use `prompt` for multi-line content that needs clean formatting
- Use `line` for titles, labels, and single-line content
- Use `section` to create clearly delimited blocks in your prompts
- Combine with `listAnd`/`listOr` for natural language lists

### JSON Utilities

- Use `parseJSONStream` when dealing with potentially incomplete data
- Use `safeParse` when you want to handle both JSON and plain text
- Use `getSchema` to understand the structure of dynamic data
- Use `safeStringify` for consistent serialization

### Helper Utilities

- Use `hashString` for creating deterministic keys or IDs
- Use `shortUID` when you need human/LLM-readable unique identifiers

## TypeScript Support

All functions include full TypeScript definitions:

```ts
// Template tags
function prompt(strings: TemplateStringsArray, ...values: any[]): string;
function line(strings: TemplateStringsArray, ...values: any[]): string;

// List functions
function listAnd(items: string[], singleLine?: boolean): string;
function listOr(items: string[], singleLine?: boolean): string;

// Section function
function section(label: string, body: string): string;

// JSON utilities
function parseJSONStream(input: string): any | null;
function getSchema(input: any): Schema;
function safeParse<T = object>(str: string): T | string;
function safeStringify(result: object): string;

// Helper utilities
function hashString(str: string): Promise<string>;
function shortUID(prefix?: string): string;
```

ESM-only package - use `import` syntax.
