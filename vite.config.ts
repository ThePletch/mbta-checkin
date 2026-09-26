import { defineConfig } from "vite";

const MBTA_CACHED_API =
  "https://api-v3.mbta.com/";

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/mbta-api": {
        target: MBTA_CACHED_API,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mbta-api/, ""),
      },
    },
  },
});
