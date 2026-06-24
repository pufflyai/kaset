# Contributing Guide

Hi! We're excited that you're interested in contributing to Kaset. Before you start, please read through the guidelines below so that we can keep the workflow smooth for everyone involved.

- [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
- [Security Policy](./SECURITY.md)
- [Pull Request Guidelines](#pull-request-guidelines)

## Pull Request Guidelines

- Create a topic branch from the relevant base branch (usually `main`) and open pull requests against that branch.
- If you're proposing a feature:
  - Share a compelling reason for the change. When possible, open a discussion or issue first so the team can confirm the approach before you invest significant time.
- If you're fixing a bug:
  - Describe the bug in detail. Include reproduction steps and, if possible, a minimal demo or failing test.
- Small, incremental commits are welcome—GitHub can squash them at merge time.
- Follow the conventional commits format for commit messages (for example, `feat: add sync retry backoff`).

## Development Setup

Kaset is a Bun >=1.3.13 monorepo managed with Bun workspaces, Lerna, and Nx.

```bash
bun install      # install dependencies
bun run lint     # lint all packages
bun run build    # build all packages via Lerna
bun run test     # run all package test suites
```

Before submitting a pull request, run the same checks CI expects:

```bash
bun run format:check
bun run lint
bunx lerna run build
bunx lerna run test
```

Additional utilities:

- `bun run format` - auto-format supported files with Biome.
- `bun run clean` – remove `node_modules`, build artifacts, and caches.
- `bun run reset:all` – clean, install, lint, build, and test in one go.

## Documentation and Playground

The VitePress documentation site lives in `clients/documentation/`:

```bash
bun run --filter documentation start   # start docs locally with HMR
bun run --filter documentation build   # build the static site
```

The playground app lives in `clients/playground/` and can be started with its workspace-specific scripts.

Thanks again for taking the time to contribute! We look forward to your ideas and improvements.
