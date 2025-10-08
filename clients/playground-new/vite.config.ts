import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), svgr()],
    base: env.VITE_BASE_URL,
    build: {
      assetsInlineLimit: 0,
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
