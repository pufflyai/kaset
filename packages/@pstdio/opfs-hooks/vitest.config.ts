import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
  },
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  resolve: {
    // Force a single React instance by always resolving to the root copy.
    dedupe: ["react", "react-dom"],
    alias: {
      react: resolve(__dirname, "../../..", "node_modules/react/index.js"),
      "react/jsx-runtime": resolve(__dirname, "../../..", "node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": resolve(__dirname, "../../..", "node_modules/react/jsx-dev-runtime.js"),
      "react-dom": resolve(__dirname, "../../..", "node_modules/react-dom/index.js"),
      "@": resolve(__dirname, "./src"),
    },
  },
});
