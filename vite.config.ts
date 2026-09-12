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
  build: {
    // Target ES2015 so the main bundle is readable by Safari 12+
    target: ['es2015', 'safari12'],
  },
  plugins: [
    react(),
    legacy({
      // Generate a legacy bundle for very old browsers (Safari < 12)
      targets: ['iOS >= 11', 'Safari >= 11'],
      modernPolyfills: ['es.promise.finally', 'es/global-this'],
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
