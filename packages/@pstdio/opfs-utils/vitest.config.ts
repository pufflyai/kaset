/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {},
  test: {
    globals: true,
    environment: "node",
  },
});
