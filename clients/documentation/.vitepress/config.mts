import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/docs/",
  title: "Datazine Docs",
  description: "",
  srcDir: "./pages",
  lastUpdated: true,
  head: [["link", { rel: "icon", href: "/docs/favicon.ico" }]],
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
    socialLinks: [{ icon: "discord", link: "https://discord.gg/3RxwUEk8fW" }],
  },
});
