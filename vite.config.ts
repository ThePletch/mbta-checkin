import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

const MBTA_CACHED_API = "https://api-v3.mbta.com/";

/** URL prefix the built site is served from. DEPLOY_PATH is required; use "/" for the site root. */
function publishBase(): string {
  const raw = process.env.DEPLOY_PATH;
  if (raw == null || raw.trim() === "") {
    throw new Error('DEPLOY_PATH is required. Use "/" to publish at the site root.');
  }
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
}

function copyUnbundledAssets(): Plugin {
  const copies: Array<{ from: string; to: string }> = [
    { from: "img", to: "img" },
    { from: "favicon.ico", to: "favicon.ico" },
    { from: "js/lib/vendor/analytics.js", to: "js/lib/vendor/analytics.js" },
  ];

  return {
    name: "copy-unbundled-assets",
    apply: "build",
    closeBundle() {
      const dist = resolve("dist");
      for (const { from, to } of copies) {
        cpSync(resolve(from), resolve(dist, to), { recursive: true });
      }
    },
  };
}

function requireEnv(env: Record<string, string>, name: string): void {
  if ((env[name] ?? "").trim() === "") {
    throw new Error(`${name} is required.`);
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  requireEnv(env, "VITE_GOOGLE_MAPS_API_KEY");
  return {
    base: command === "build" ? publishBase() : "/",
    plugins: [copyUnbundledAssets()],
    server: {
      port: 3001,
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
  };
});
