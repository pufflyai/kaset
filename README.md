![Kaset banner](https://kaset.dev/images/kaset.png)

**Kaset** [kaˈset] is an open source toolkit to build browser-first, agentic web apps.

[Docs](https://kaset.dev/) • [Playground](https://kaset.dev/playground) • [Issues](https://github.com/pufflyai/kaset/issues) • [MIT License](https://github.com/pufflyai/kaset/blob/main/LICENSE)

![bun](https://img.shields.io/badge/bun-%3E%3D1.3.13-000000?logo=bun&logoColor=white)
![lerna](https://img.shields.io/badge/monorepo-lerna-9333EA)
![docs](https://img.shields.io/badge/docs-vitepress-2ea043)

> Kaset is in early development, [join our discussions](https://github.com/pufflyai/kaset/discussions) and help shape it.

## Introduction

Programming has always been a _prelude_: developers write code, ship it, and users consume it.

Now imagine your average user being able to create plugins for your web app on the fly.

No coding experience required.

Directly _inside_ your app.

Curious? Check out our [documentation](https://kaset.dev).

## Contents

- Packages overview
- Local development
- Docs site

## Packages

> ### [@pstdio/kas](https://kaset.dev/packages/kas)
>
> A simple coding agent for the browser.

> ### [@pstdio/opfs-hooks](https://kaset.dev/packages/opfs-hooks)
>
> React hooks for working with the browser's Origin Private File System.

> ### [@pstdio/opfs-utils](https://kaset.dev/packages/opfs-utils)
>
> OPFS helpers: ls/tree, grep, safe file reads (text/binary/SVG/PDF), patch utilities.

> ### [@pstdio/opfs-sync](https://kaset.dev/packages/opfs-sync)
>
> Two‑way sync between OPFS and a remote S3 like provider (Supabase adapter included).

> ### [@pstdio/prompt-utils](https://kaset.dev/packages/prompt-utils)
>
> Prompt/JSON helpers for LLM workflows.

> ### [@pstdio/tiny-ai-tasks](https://kaset.dev/packages/tiny-ai-tasks)
>
> AI task building blocks: streaming LLM tasks with tool calls, a minimal agent loop, history truncation/summarization, and scratchpad utilities.

> ### [@pstdio/tiny-plugins](https://kaset.dev/packages/tiny-plugins)
>
> Plugin runtime for OPFS-backed plugins with manifest validation, command routing, and settings persistence.

> ### [@pstdio/tiny-tasks](https://kaset.dev/packages/tiny-tasks)
>
> Composable, interrupt-friendly workflows for TypeScript/JavaScript. Pause, persist, and resume long-running work.

> ### [@pstdio/tiny-ui](https://kaset.dev/packages/tiny-ui)
>
> Browser-first plugin runtime that compiles OPFS sources with esbuild-wasm and exposes host capabilities to plugin iframes.

> ### [@pstdio/tiny-ui-bundler](https://kaset.dev/packages/tiny-ui-bundler)
>
> Service worker bundler and runtime asset manager for Tiny UI plugins.

> ### [@pstdio/describe-context](https://kaset.dev/packages/describe-context)
>
> Generate an LLM‑ready Markdown context for a folder (library + CLI).

## Local development

Requires Bun >=1.3.13. From repo root:

```bash
bun install         # install
bun run build       # build all packages (lerna)
bun run test        # run all tests
```

Helpful scripts:

- `bun run format` • `bun run format:check`
- `bun run lint`
- `bun run clean`
- `bun run reset:all` (clean → install → lint → build → test)

Per‑workspace examples:

```bash
bun run --filter @pstdio/opfs-utils build
bun run --filter @pstdio/opfs-sync test
```

## Docs site

VitePress site lives in `clients/documentation/`.

```bash
bun run --filter documentation start   # dev server
bun run --filter documentation build   # static build
```

## License

MIT © Pufflig AB. See `LICENSE`.
