import { externalizeDeps } from "@au-re/vite-plugin-externalize-deps";
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const entries = {
  index: path.resolve(__dirname, "src/index.ts"),
};

export default defineConfig({
  build: {
    lib: {
      entry: entries,
      name: "kaset-micro-ui",
      fileName: (_format, entryName) => {
        if (entryName === "index") return "index.js";
        return `${entryName}.js`;
      },
      formats: ["es"],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [
    dts(),
    externalizeDeps({
      include: [/react$/],
    }),
  ],
});
