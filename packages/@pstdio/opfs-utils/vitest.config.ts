/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      diff: path.resolve(__dirname, "src/__mocks__/diff.ts"),
      "isomorphic-git": path.resolve(__dirname, "src/__mocks__/isomorphic-git.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
