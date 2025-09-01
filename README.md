# @pstdio Core Utils

Small, focused utilities for browser‑first apps: OPFS helpers, OPFS↔remote sync, prompt utilities, and repo context generation.

[Docs](https://pufflyai.github.io/core-utils/) • [Issues](https://github.com/pufflyai/core-utils/issues) • [MIT License](https://github.com/pufflyai/core-utils/blob/main/LICENSE)

![node](https://img.shields.io/badge/node-22.x-3C873A?logo=node.js&logoColor=white)
![lerna](https://img.shields.io/badge/monorepo-lerna-9333EA)
![docs](https://img.shields.io/badge/docs-vitepress-2ea043)

## Contents

- Packages overview
- Local development
- Docs site

## Packages

> ### [@pstdio/opfs-utils](https://pufflyai.github.io/core-utils/packages/opfs-utils)
>
> OPFS helpers: ls/tree, grep, safe file reads (text/binary/SVG/PDF), patch utilities.

> ### [@pstdio/opfs-sync](https://pufflyai.github.io/core-utils/packages/opfs-sync)
>
> Two‑way sync between OPFS and a remote S3 like provider (Supabase adapter included).

> ### [@pstdio/prompt-utils](https://pufflyai.github.io/core-utils/packages/prompt-utils)
>
> Prompt/JSON helpers for LLM workflows.

> ### [@pstdio/describe-context](https://pufflyai.github.io/core-utils/packages/describe)
>
> Generate an LLM‑ready Markdown context for a folder (library + CLI).

## Local development

Requires Node.js 22 (see Volta pin in `package.json`). From repo root:

```bash
npm i               # install
npm run build       # build all packages (lerna)
npm run test        # run all tests
```

Helpful scripts:

- `npm run format` • `npm run format:check`
- `npm run lint`
- `npm run clean`
- `npm run reset:all` (clean → install → lint → build → test)

Per‑workspace examples:

```bash
npm run build --workspace @pstdio/opfs-utils
npm run test  --workspace @pstdio/opfs-sync
```

## Docs site

VitePress site lives in `clients/documentation/`.

```bash
npm run start --workspace documentation   # dev server
npm run build --workspace documentation   # static build
```

## License

MIT © Pufflig AB. See `LICENSE`.
