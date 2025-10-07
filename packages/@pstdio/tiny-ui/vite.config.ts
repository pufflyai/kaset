import { externalizeDeps } from "@au-re/vite-plugin-externalize-deps";
import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const rootDir = __dirname;
const libraryEntry = path.resolve(rootDir, "src/index.ts");
const serviceWorkerEntry = path.resolve(rootDir, "src/sw/sw.ts");
const runtimeHtmlSource = path.resolve(rootDir, "src/sw/runtime.html");

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: libraryEntry,
        sw: serviceWorkerEntry,
      },
      name: "tiny-plugins",
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
    {
      name: "copy-runtime-html",
      apply: "build",
      async closeBundle() {
        const targetDir = path.resolve(rootDir, "dist");
        await fs.mkdir(targetDir, { recursive: true });
        await fs.copyFile(runtimeHtmlSource, path.resolve(targetDir, "runtime.html"));
      },
    },
  ],
});
