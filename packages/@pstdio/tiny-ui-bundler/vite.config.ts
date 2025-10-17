import { externalizeDeps } from "@au-re/vite-plugin-externalize-deps";
import path from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const rootDir = __dirname;
const libraryEntry = path.resolve(rootDir, "src/index.ts");

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: libraryEntry,
      },
      name: "tiny-ui-bundler",
      fileName: (_format, entryName) => {
        if (entryName === "index") return "index.js";
        return `${entryName}.js`;
      },
      formats: ["es"],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    dts(),
    externalizeDeps({
      include: [/react$/],
    }),
  ],
});
