# @pstdio/tiny-ui

## 0.2.2

### Patch Changes

- 4051500: Pin the esbuild wasm binary to the installed `esbuild-wasm` host version. `tiny-ui-bundler` now exports `DEFAULT_ESBUILD_WASM_URL`, derived from the installed version, and `tiny-ui`'s provider uses it instead of a hardcoded URL — preventing esbuild's "Host version does not match binary version" error when the host and binary drift.
- Updated dependencies [4051500]
  - @pstdio/tiny-ui-bundler@0.1.3
  - @pstdio/tiny-plugins@0.2.2
