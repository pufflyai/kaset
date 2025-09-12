---
title: Changelog
---

# Changelog

All notable changes to Kaset are documented here. This monorepo contains multiple packages under the `@pstdio` scope; versioning is tracked per package.

For package-specific details, see:

- [@pstdio/kas](/packages/kas)
- [@pstdio/opfs-utils](/packages/opfs-utils)
- [@pstdio/opfs-sync](/packages/opfs-sync)
- [@pstdio/prompt-utils](/packages/prompt-utils)
- [@pstdio/tiny-ai-tasks](/packages/tiny-ai-tasks)
- [@pstdio/tiny-tasks](/packages/tiny-tasks)
- [describe-context](/packages/describe-context)

## 2025-01-25

### Added

- [@pstdio/kas] **NEW PACKAGE**: Browser-first coding agent (v0.1.0).
  - Complete AI-powered coding assistant running entirely in the browser
  - OPFS sandbox with approval gates for safe file operations
  - Built-in tools for search, read, write, patch, and shell operations
  - Conversation adapters for easy UI integration with streaming responses
  - Used in the [Kaset Playground](https://kaset.dev) for live demonstrations

### Changed

- [documentation] Added comprehensive documentation for @pstdio/kas package
- [documentation] Updated KAS concept page with implementation details and examples
- [README] Added @pstdio/kas to main packages list
- Navigation updated to include kas package in all relevant sections

---

## 2025-09-07

### Added

- [playground] Added Kaset Playground - a collection of agentic web app demos showcasing the @pstdio packages.

---

## 2025-09-05

### Added

- [@pstdio/tiny-ai-tasks] Initial release: AI workflows and tool-using agents for building streaming LLM tasks (v0.1.0).
- [@pstdio/tiny-tasks] Initial release: composable, interrupt-friendly workflows (v0.1.0).
- [documentation] Added package page and navigation link for `@pstdio/tiny-tasks`.

### Changed

- [README] Added `@pstdio/tiny-ai-tasks` and `@pstdio/tiny-tasks` to the packages list.
- [AGENTS] Added `@pstdio/tiny-ai-tasks` and `@pstdio/tiny-tasks` sections with commands and overview.

---

## Initial Preview

First public preview of the Kaset packages and documentation.

- @pstdio/opfs-utils: 0.1.3
- @pstdio/opfs-sync: 0.1.0
- @pstdio/prompt-utils: 0.1.0
- describe-context: 0.1.5
