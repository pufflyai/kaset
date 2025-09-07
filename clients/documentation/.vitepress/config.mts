import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/kaset/",
  title: "Kaset",
  description: "Make your webapps modable with built-in coding agents.",
  srcDir: "./pages",
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    [
      "meta",
      {
        property: "og:image",
        content: "/images/kaset.png",
      },
    ],
  ],
  themeConfig: {
    logo: "/logo_inverted.svg",
    search: {
      provider: "local",
    },
    nav: [
      { text: "Playground", link: "https://kaset.dev" },
      {
        text: "Packages",
        items: [
          { text: "@pstdio/opfs-utils", link: "/packages/opfs-utils" },
          { text: "@pstdio/opfs-sync", link: "/packages/opfs-sync" },
          { text: "@pstdio/prompt-utils", link: "/packages/prompt-utils" },
          { text: "@pstdio/tiny-ai-tasks", link: "/packages/tiny-ai-tasks" },
          { text: "@pstdio/tiny-tasks", link: "/packages/tiny-tasks" },
          { text: "describe-context", link: "/packages/describe-context" },
        ],
      },
      { text: "FAQ", link: "/faq" },
      { text: "Changelog", link: "/changelog" },
    ],
    sidebar: [
      { text: "Introduction", link: "/" },
      { text: "FAQ", link: "/faq" },
      { text: "Changelog", link: "/changelog" },
      {
        text: "Packages",
        items: [
          { text: "@pstdio/opfs-utils", link: "/packages/opfs-utils" },
          { text: "@pstdio/opfs-sync", link: "/packages/opfs-sync" },
          { text: "@pstdio/prompt-utils", link: "/packages/prompt-utils" },
          { text: "@pstdio/tiny-ai-tasks", link: "/packages/tiny-ai-tasks" },
          { text: "@pstdio/tiny-tasks", link: "/packages/tiny-tasks" },
          { text: "describe-context", link: "/packages/describe-context" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/pufflyai/kaset" }],
  },
});
