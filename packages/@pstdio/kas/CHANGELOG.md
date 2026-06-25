# @pstdio/kas

## 0.3.0

### Minor Changes

- 0bb6060: `createKasAgent` now takes a constructed `model` object (built with `openaiModel` or `webLLMModel`) instead of a `model` string plus `apiKey`/`baseURL`. The model factories are re-exported from `@pstdio/kas`.

  BREAKING: the previous string-based `model`/`apiKey`/`baseURL`/`reasoning`/`dangerouslyAllowBrowser` options are removed. Migrate with:

  ```ts
  // before
  createKasAgent({ model: "gpt-5-mini", apiKey });
  // after
  import { openaiModel } from "@pstdio/kas";
  createKasAgent({ model: openaiModel({ model: "gpt-5-mini", apiKey }) });
  ```

### Patch Changes

- Updated dependencies [0bb6060]
  - @pstdio/tiny-ai-tasks@0.3.0
