import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://orenza.ir",
  output: "static",
  integrations: [sitemap()],
  build: {
    assets: "_assets"
  }
});
