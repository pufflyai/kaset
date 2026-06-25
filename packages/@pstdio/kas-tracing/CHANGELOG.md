# @pstdio/kas-tracing

## 0.1.0

### Minor Changes

- a2fafe2: Add `@pstdio/kas-tracing`: browser-first LangSmith tracing for `@pstdio` AI agents. Wrap a `Model` or `Tool` and stream a nested root → LLM → tool run tree to LangSmith using the `RunTree` API with explicit parent references (no `AsyncLocalStorage`), so nesting works client-side. Includes a configurable endpoint for US/EU regions and a zero-overhead passthrough when disabled.

### Patch Changes

- Updated dependencies [0bb6060]
  - @pstdio/tiny-ai-tasks@0.3.0
