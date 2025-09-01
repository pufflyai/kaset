# describe-context

[![npm version](https://img.shields.io/npm/v/describe-context.svg?color=blue)](https://www.npmjs.com/package/describe-context)
[![license](https://img.shields.io/npm/l/describe-context)](https://github.com/pufflyai/core-utils/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/describe-context)](https://bundlephobia.com/package/describe-context)

Analyze a folder and generate a compact Markdown “context” that’s great for LLM prompts, code reviews, and summaries. Includes a simple CLI and a small, reusable API.

## Highlights

- Directory tree + selected file contents (auto-fenced with language hints)
- Skips large, binary, and irrelevant files with sensible defaults
- Rough token estimate (chars/4) to keep you within LLM limits
- Works as both a CLI (`npx describe-context`) and library (ESM)

---

## Install

- Library: `npm i describe-context`
- CLI (ad‑hoc): `npx describe-context <folder>`

Node 18+ recommended.

---

## CLI

Usage:

```
describe-context <folder> [output.md]
```

Examples:

```
# write to an explicit file
npx describe-context . repo-context.md

# use the default name: <folder's basename>-context.md
npx describe-context my-project
```

What it does:

- Analyzes the folder
- Writes a Markdown file with a directory structure and relevant file contents
- Prints basic stats to the terminal (size, estimated tokens, warnings about limits)

Exit codes:

- 0 on success
- 1 on usage errors (e.g., missing folder)

---

## Library

Install:

```sh
npm i describe-context
```

Basic usage:

```ts
import { generateContext } from "describe-context";

const { markdown, files, stats } = await generateContext("/path/to/folder");
// write markdown to disk, send to an LLM, or display it somewhere
```

### Lower-level building blocks

If you want to customize the output, you can use the underlying helpers:

```ts
import { analyzeDirectory, generateDirectoryTree, generateFileContent, estimateTokenCount } from "describe-context";

const files = await analyzeDirectory(folder, folder);
const markdown = [generateDirectoryTree(files, folder), generateFileContent(files)].join("\n");
const tokens = estimateTokenCount(markdown);
```

---

## What gets included (heuristics)

Relevant by default:

- Common source and config extensions: ts, js, tsx, jsx, py, rb, go, rs, java, kt, php, cs, c/cpp, html/css/scss/sass, vue/svelte/astro, json, yaml/yml, toml, ini, md/mdx, txt, rst, sql, graphql/gql, sh/bash, Dockerfile, .env variations, .gitignore, .editorconfig, prettier/eslint/tsconfig variants
- Key meta files: README.md, CHANGELOG.md, LICENSE, CONTRIBUTING.md, Makefile, docker-compose.\*

Skipped by default:

- Directories: node_modules, .git, dist/build, .next/.nuxt, .vscode, .idea, coverage, vendor, tmp, logs, storybook, and similar
- Files: lock/log/cache/temp/swap maps, minified bundles, .d.ts, various generated configs
- Size limits: files > 1 MB are skipped; total content is capped around 10 MB
- Binary detection: files with NUL bytes are treated as binary and skipped

These defaults aren’t configurable yet. For full control, use the lower-level APIs and implement your own filters.

---

## Notes & limitations

- Token estimate is a rough heuristic (characters/4). Real tokenizer counts vary per model.
- Very large repos will be truncated once aggregate content reaches the size cap.
- CLI writes the Markdown to a file (it does not stream the Markdown to stdout).

---

## License

MIT © Pufflig AB
