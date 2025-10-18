import fs from "node:fs/promises";
import path from "node:path";

import { build as bundleServiceWorker } from "esbuild";
import type { StorybookConfig } from "@storybook/react-vite";
import type { PluginOption } from "vite";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return path.dirname(require.resolve(path.join(value, "package.json")));
}

const tinyUiRootDir = path.resolve(__dirname, "..");
const runtimeHtmlPath = path.resolve(tinyUiRootDir, "src/runtime/runtime.html");
const serviceWorkerEntry = path.resolve(__dirname, "../../tiny-ui-bundler/src/sw.ts");
const runtimeRequestPath = "/tiny-ui/runtime.html";
const serviceWorkerRequestPath = "/tiny-ui-sw.js";

const createTinyUiAssetsPlugin = (): PluginOption => {
  let runtimeHtml = "";
  let serviceWorkerCode = "";
  let serviceWorkerDependencies = new Set<string>();
  let assetsReady = false;

  const loadAssets = async () => {
    runtimeHtml = await fs.readFile(runtimeHtmlPath, "utf8");

    const result = await bundleServiceWorker({
      absWorkingDir: path.resolve(tinyUiRootDir, ".."),
      bundle: true,
      entryPoints: [serviceWorkerEntry],
      format: "iife",
      metafile: true,
      platform: "browser",
      sourcemap: false,
      target: ["es2020"],
      write: false,
    });

    const inputs = Object.keys(result.metafile?.inputs ?? {});
    serviceWorkerDependencies = new Set(inputs.map((input) => path.resolve(tinyUiRootDir, input)));
    serviceWorkerDependencies.add(serviceWorkerEntry);

    serviceWorkerCode = result.outputFiles[0]?.text ?? "";
    assetsReady = true;
  };

  const ensureAssetsLoaded = async () => {
    if (assetsReady) return;
    await loadAssets();
  };

  return {
    name: "tiny-ui-storybook-assets",
    async buildStart() {
      this.addWatchFile(runtimeHtmlPath);
      await loadAssets();
      for (const dependency of serviceWorkerDependencies) {
        this.addWatchFile(dependency);
      }
    },
    async handleHotUpdate(ctx) {
      const changedFile = path.resolve(ctx.file);
      if (changedFile === runtimeHtmlPath || serviceWorkerDependencies.has(changedFile)) {
        await loadAssets();
        ctx.server.ws.send({ type: "full-reload" });
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        await ensureAssetsLoaded();

        if (!req.url) {
          next();
          return;
        }

        if (req.url === runtimeRequestPath) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(runtimeHtml);
          return;
        }

        if (req.url === serviceWorkerRequestPath) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.end(serviceWorkerCode);
          return;
        }

        next();
      });
    },
    async generateBundle() {
      await ensureAssetsLoaded();
      this.emitFile({ type: "asset", fileName: runtimeRequestPath.slice(1), source: runtimeHtml });
      this.emitFile({ type: "asset", fileName: serviceWorkerRequestPath.slice(1), source: serviceWorkerCode });
    },
  };
};

const config: StorybookConfig = {
  stories: ["../playground/**/*.stories.@(js|jsx|mjs|ts|tsx)", "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-themes"),
    getAbsolutePath("storybook-addon-vis"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  staticDirs: [],
  async viteFinal(existingConfig) {
    const plugins = existingConfig.plugins ?? [];
    plugins.push(createTinyUiAssetsPlugin());
    return {
      ...existingConfig,
      plugins,
    };
  },
};

export default config;
