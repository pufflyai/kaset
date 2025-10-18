import path from "node:path";

import type { StorybookConfig } from "@storybook/react-vite";
import { build as bundleServiceWorker } from "esbuild";
import type { PluginOption } from "vite";

function getAbsolutePath(value: string): any {
  return path.dirname(require.resolve(path.join(value, "package.json")));
}

const tinyUiBundlerRootDir = path.resolve(__dirname, "..");
const serviceWorkerEntry = path.resolve(tinyUiBundlerRootDir, "src/sw.ts");
const serviceWorkerRequestPath = "/tiny-ui-sw.js";

const createTinyUiBundlerSwPlugin = (): PluginOption => {
  let serviceWorkerCode = "";
  let serviceWorkerDependencies = new Set<string>();
  let assetsReady = false;

  const loadAssets = async () => {
    const result = await bundleServiceWorker({
      absWorkingDir: tinyUiBundlerRootDir,
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
    serviceWorkerDependencies = new Set(inputs.map((input) => path.resolve(tinyUiBundlerRootDir, input)));
    serviceWorkerDependencies.add(serviceWorkerEntry);

    serviceWorkerCode = result.outputFiles[0]?.text ?? "";
    assetsReady = true;
  };

  const ensureAssetsLoaded = async () => {
    if (assetsReady) return;
    await loadAssets();
  };

  return {
    name: "tiny-ui-bundler-storybook-sw",
    async buildStart() {
      await loadAssets();
      for (const dependency of serviceWorkerDependencies) {
        this.addWatchFile(dependency);
      }
    },
    async handleHotUpdate(ctx) {
      const changedFile = path.resolve(ctx.file);
      if (serviceWorkerDependencies.has(changedFile)) {
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
    plugins.push(createTinyUiBundlerSwPlugin());
    return {
      ...existingConfig,
      plugins,
    };
  },
};

export default config;
