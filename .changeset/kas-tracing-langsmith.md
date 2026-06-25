---
"@pstdio/kas-tracing": minor
---

Add `@pstdio/kas-tracing`: browser-first LangSmith tracing for `@pstdio` AI agents. Wrap a `Model` or `Tool` and stream a nested root → LLM → tool run tree to LangSmith using the `RunTree` API with explicit parent references (no `AsyncLocalStorage`), so nesting works client-side. Includes a configurable endpoint for US/EU regions and a zero-overhead passthrough when disabled.
