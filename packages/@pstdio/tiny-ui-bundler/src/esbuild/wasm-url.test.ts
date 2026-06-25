import { version } from "esbuild-wasm";
import { describe, expect, it } from "vitest";
import { DEFAULT_ESBUILD_WASM_URL } from "./wasm-url";

describe("DEFAULT_ESBUILD_WASM_URL", () => {
  // Guards against esbuild's "Host version does not match binary version" error:
  // the wasm binary must be pinned to the installed esbuild host version.
  it("pins the wasm binary to the installed esbuild host version", () => {
    expect(DEFAULT_ESBUILD_WASM_URL).toBe(`https://unpkg.com/esbuild-wasm@${version}/esbuild.wasm`);
  });
});
