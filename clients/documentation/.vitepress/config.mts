import "dotenv/config";
import { defineConfig } from "vitepress";

const base = process.env.BASE_URL ?? "/kaset/";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base,
  title: "Kaset",
  description: "Make your webapps modable with built-in coding agents.",
  srcDir: "./pages",
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: `favicon.ico` }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "",
      },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Onest:wght@400;500;700&family=Playfair+Display:wght@400;600;700&display=swap",
      },
    ],
    [
      "meta",
      {
        property: "og:image",
        content: "/images/kaset.png",
      },
    ],
  ],
  themeConfig: {
    logo: {
      light: "/cassette-tape.svg",
      dark: "/cassette-tape-dark.svg",
    },
    search: {
      provider: "local",
    },
    nav: [
      { text: "Playground", link: "https://kaset.dev/playground" },
      {
        text: "Packages",
        items: [
          { text: "@pstdio/kas", link: "/packages/kas" },
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
          { text: "Your App as a Filesystem", link: "/concepts/filesystem" },
          { text: "Coding Agents in the Browser", link: "/concepts/kas" },
          { text: "Versioning Changes", link: "/concepts/versioning" },
        ],
      },
      {
        text: "Modable Webapps",
        items: [
          { text: "Artifacts", link: "/modifications/artifacts" },
          { text: "Application State", link: "/modifications/app-state" },
          { text: "Agent Behavior", link: "/modifications/behavior" },
          { text: "Plugins", link: "/modifications/plugins" },
        ],
      },
      {
        text: "Packages",
        items: [
          { text: "Overview", link: "/packages/overview" },
          { text: "@pstdio/kas", link: "/packages/kas" },
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
    socialLinks: [{ icon: "github", link: "https://github.com/pufflyai/kaset" }],
  },
});
