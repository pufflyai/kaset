---
title: Changelog
---

# Changelog

All notable changes to Kaset are documented here. This monorepo contains multiple packages under the `@pstdio` scope.

## 2025-09-30

### Added

- [documentation] Dedicated guides for building Kaset modifications and plugins, including lifecycle walkthroughs and live examples.
- [playground] Model Context Protocol (MCP) service connector with UI components to discover remote tools, manage credentials, and register them with running agents.

### Changed

- [@pstdio/kas] Updated prompts and tool wiring so agents surface MCP tools discovered at runtime.
- [@pstdio/tiny-ai-tasks] Extended tool adapters and tests to emit MCP-compatible definitions for remote plugins.

### Published

- @pstdio/kas@0.1.3
- @pstdio/opfs-hooks@0.1.5
- @pstdio/opfs-sync@0.1.2
- @pstdio/opfs-utils@0.1.7
- @pstdio/prompt-utils@0.1.2
- @pstdio/tiny-ai-tasks@0.1.2
- @pstdio/tiny-tasks@0.1.2
- describe-context@0.1.7

## 2025-09-28

### Changed

- [playground] Conversation IDs now route through as session identifiers so reconnects and retries keep the correct context.
- [@pstdio/tiny-ai-tasks] `createAgent` and `createLLMTask` accept external session IDs, keeping transcripts aligned with the UI.

## 2025-09-19

### Changed

- [playground] Custom API base URLs no longer require an API key, and the settings modal now exposes the configuration clearly.
- [documentation] Added configuration guidance for overriding the API base URL in the docs site build pipeline.
- [@pstdio/kas] Made the agent reasoning step optional so hosts can disable intermediate reasoning when not desired.
- [documentation] Expanded the artifacts checklist with additional validation steps.

## 2025-09-17

### Changed

- [playground] Unified the todo demo hooks so both OPFS sync and directory watching take the same store instance.
- [playground] Expanded `agents.md` and README guidance to cover editing `todo/state.json` and auto-navigating to new lists.
- [documentation] Extended the Application State page with the todo playground example and rationale for exposing state files to agents.
- [@pstdio/opfs-utils] JSON storage and directory watcher usage for keeping OPFS-backed todo state current.
- [@pstdio/opfs-hooks] add `useOpfsStoreBinding` as bridge between stores and OPFS state files.
- [documentation] Corrected approval-gated tool examples and quick start numbering in the Getting Started guide.

### Fixed

- [playground] Prevented the initial chat autoscroll from jumping the page when the first conversation loads.

### Removed

- [playground] Removed the clear conversation action from the settings modal to simplify the control set.

## 2025-09-16

### Changed

- [playground] A dedicated Zustand provider for the TODO demo.
- [playground] Added mobile version of the playground.

## 2025-09-15

### Changed

- [playground] Tuned the TODO demo prompts and patch flow for clearer guidance.
- [playground] Expanded documentation to cover the @pstdio/kas playground setup.

## 2025-09-12

### Added

- [@pstdio/kas] **NEW PACKAGE**: Browser-first coding agent (v0.1.0).
  - Simple AI-powered coding assistant running entirely in the browser
  - OPFS sandbox with approval gates for safe file operations
  - Built-in tools for search, read, write, patch, and shell operations
  - Conversation adapters for easy UI integration with streaming responses
  - Check out [Kaset Playground](https://kaset.dev) for live demonstrations

### Changed

- [documentation] Added documentation for @pstdio/kas package

## 2025-09-07

### Added

- [playground] Added Kaset Playground - a collection of agentic web app demos showcasing the @pstdio packages.

## 2025-09-05

### Added

- [@pstdio/tiny-ai-tasks] Initial release: AI workflows and tool-using agents for building streaming LLM tasks (v0.1.0).
- [@pstdio/tiny-tasks] Initial release: composable, interrupt-friendly workflows (v0.1.0).
- [documentation] Added package page and navigation link for `@pstdio/tiny-tasks`.

### Changed

- [README] Added `@pstdio/tiny-ai-tasks` and `@pstdio/tiny-tasks` to the packages list.
- [AGENTS] Added `@pstdio/tiny-ai-tasks` and `@pstdio/tiny-tasks` sections with commands and overview.

## Initial Preview

First public preview of the Kaset packages and documentation.

- @pstdio/opfs-utils: 0.1.3
- @pstdio/opfs-sync: 0.1.0
- @pstdio/prompt-utils: 0.1.0
- describe-context: 0.1.5
