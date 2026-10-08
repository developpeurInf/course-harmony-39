import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    legacy({
      // legacy : navigateurs sans modules ES (vieux Android / WebView, iOS 10-11)
      targets: ['defaults', 'not IE 11', 'iOS >= 10', 'Safari >= 10', 'Android >= 5', 'Chrome >= 49', 'Samsung >= 5'],
      // moderne : iPad iOS 12.5.x (Safari 12.1) et tous les navigateurs récents
      modernTargets: ['safari >= 12', 'iOS >= 12', 'chrome >= 64', 'edge >= 79', 'firefox >= 67', 'samsung >= 9'],
      modernPolyfills: true,
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
