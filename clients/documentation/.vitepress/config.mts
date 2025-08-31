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
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      //  { text: "Guides", link: "/guides/getting-started" },
      // { text: "API Reference", link: "/api/getting-started" },
      // { text: "Blog", link: "https://prompt.studio/product-updates/" },
    ],
    sidebar: [{ text: "Introduction", link: "/" }],
    socialLinks: [{ icon: "discord", link: "https://discord.gg/3RxwUEk8fW" }],
  },
});
