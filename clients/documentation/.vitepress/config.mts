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
        text: "Getting Started",
        items: [
          { text: "What is Kaset?", link: "/getting-started/what-is-kaset" },
          { text: "Quick Start", link: "/getting-started/quick-start" },
          { text: "Supported Browsers", link: "/getting-started/supported-browsers" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Meet KAS", link: "/concepts/kas" },
          { text: "Your App as a Filesystem", link: "/concepts/filesystem" },
          { text: "Artifacts", link: "/concepts/artifacts" },
          { text: "App State", link: "/concepts/app-state" },
          { text: "UI", link: "/concepts/ui" },
          { text: "Browser Agents", link: "/concepts/browser-agents" },
        ],
      },
      {
        text: "Packages",
        items: [
          { text: "Overview", link: "/packages/overview" },
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
