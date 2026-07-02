import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://orenza.ir",
  output: "static",
  integrations: [
    sitemap({
      filter: (page) => page !== "https://orenza.ir/404.html"
    })
  ],
  build: {
    assets: "_assets"
  }
});
