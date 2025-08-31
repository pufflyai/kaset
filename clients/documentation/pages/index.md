---
title: Datazine Core Utils
---

# Datazine Core Utils

Utilities for building browser‑first apps using the Origin Private File System (OPFS), remote sync, prompt helpers, and repo description tooling.

- OPFS utilities: list/grep/patch, safe reads, and tree formatting (browser)
- OPFS ↔ Cloud sync with pluggable remotes (Supabase adapter included)
- Prompt helpers and JSON utilities for LLM workflows
- Folder → Markdown context generator for code review and LLMs

## Packages overview

- @pstdio/opfs-utils — OPFS helpers for listing, grepping, safe reads, patching, and tree formatting. See [opfs-utils](/packages/opfs-utils).
- @pstdio/opfs-sync — Browser‑only sync engine between OPFS and a remote provider. See [opfs-sync](/packages/opfs-sync).
- @pstdio/prompt-utils — Prompt and JSON helpers for LLM workflows. See [prompt-utils](/packages/prompt-utils).
- describe-context — Analyze a folder and generate an LLM‑ready Markdown context. See [describe-context](/packages/describe).
