// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // The deploy plugin only runs during `vite build` (never `vite dev`), and
  // needs an explicit preset — passing a bare boolean lets it silently fall
  // back to its own default instead of reliably targeting each platform.
  nitro: {
    preset: process.env.VERCEL ? "vercel" : "cloudflare-module",
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
