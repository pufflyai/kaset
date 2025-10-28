import { externalizeDeps } from "@au-re/vite-plugin-externalize-deps";
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
      },
      fileName: (_, entryName) => `${entryName}.js`,
      formats: ["es"],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [dts(), externalizeDeps()],
});
