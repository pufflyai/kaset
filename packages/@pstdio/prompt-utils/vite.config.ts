import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { externalizeDeps } from "@au-re/vite-plugin-externalize-deps";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "prompt-utils",
      fileName: () => `index.js`,
      formats: ["es"],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [
    dts(),
    externalizeDeps({
      include: ["json-stable-stringify"],
    }),
  ],
});
