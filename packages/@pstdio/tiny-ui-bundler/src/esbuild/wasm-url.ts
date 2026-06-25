import { version } from "esbuild-wasm";

// Pin the wasm binary to the installed esbuild host version so the two never drift.
// A mismatch makes esbuild.initialize throw "Host version ... does not match binary version ...".
export const DEFAULT_ESBUILD_WASM_URL = `https://unpkg.com/esbuild-wasm@${version}/esbuild.wasm`;
