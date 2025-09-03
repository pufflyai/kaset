import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  // base: "/core-utils/",
  title: "Datazine Tools",
  description: "A collection of tools to build browser-first, agentic web applications",
  srcDir: "./pages",
  lastUpdated: true,
  head: [["link", { rel: "icon", href: "/favicon.ico" }]],
  themeConfig: {
    logo: "/logo_inverted.svg",
    search: {
      provider: "local",
    },
    nav: [
      {
        text: "Packages",
        items: [
          { text: "@pstdio/opfs-utils", link: "/packages/opfs-utils" },
          { text: "@pstdio/opfs-sync", link: "/packages/opfs-sync" },
          { text: "@pstdio/prompt-utils", link: "/packages/prompt-utils" },
          { text: "describe-context", link: "/packages/describe" },
        ],
      },
    ],
    sidebar: [
      { text: "Introduction", link: "/" },
      {
        text: "Packages",
        items: [
          { text: "@pstdio/opfs-utils", link: "/packages/opfs-utils" },
          { text: "@pstdio/opfs-sync", link: "/packages/opfs-sync" },
          { text: "@pstdio/prompt-utils", link: "/packages/prompt-utils" },
          { text: "describe-context", link: "/packages/describe" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/pufflyai/core-utils" }],
  },
});
