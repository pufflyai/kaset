import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ["fs", "fs/promises", "path", "url"],
      input: {
        index: path.resolve(__dirname, "src/index.ts"),
        "generate-context": path.resolve(__dirname, "src/generate-context.ts"),
      },
      output: {
        entryFileNames: (chunk) => `${chunk.name}.js`,
        format: "es",
      },
    },
  },
  plugins: [dts()],
});
