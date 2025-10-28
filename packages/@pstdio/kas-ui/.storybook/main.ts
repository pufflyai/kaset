import { dirname, join } from "path";
import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@pstdio/kas-ui": join(__dirname, "../src"),
      "@pstdio/kas": join(__dirname, "../../kas/src"),
      "@pstdio/opfs-utils": join(__dirname, "../../opfs-utils/src"),
      "@pstdio/opfs-hooks": join(__dirname, "../../opfs-hooks/src"),
      "@pstdio/prompt-utils": join(__dirname, "../../prompt-utils/src"),
      "@pstdio/tiny-ai-tasks": join(__dirname, "../../tiny-ai-tasks/src"),
    };

    return config;
  },
};

export default config;
