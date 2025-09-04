import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/kaset/",
  title: "Kaset",
  description: "A proto-framework to embed coding agents into your web apps.",
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
          { text: "describe-context", link: "/packages/describe-context" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/pufflyai/kaset" }],
  },
});
