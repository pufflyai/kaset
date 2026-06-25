---
"@pstdio/tiny-ui-bundler": patch
"@pstdio/tiny-ui": patch
---

Pin the esbuild wasm binary to the installed `esbuild-wasm` host version. `tiny-ui-bundler` now exports `DEFAULT_ESBUILD_WASM_URL`, derived from the installed version, and `tiny-ui`'s provider uses it instead of a hardcoded URL — preventing esbuild's "Host version does not match binary version" error when the host and binary drift.
