import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Bibliothèques regroupées en paquets séparés : elles changent rarement, restent en cache
 * (assets immuables) quand seul le code de l'application change, et ne sont chargées
 * que par les pages qui en ont besoin (recharts, tiptap…).
 */
const VENDOR_GROUPS: Array<[string, RegExp]> = [
  ["vendor-react", /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/],
  ["vendor-radix", /[\\/]node_modules[\\/]@radix-ui[\\/]/],
  ["vendor-supabase", /[\\/]node_modules[\\/]@supabase[\\/]/],
  ["vendor-recharts", /[\\/]node_modules[\\/](recharts|recharts-scale|d3-[^\\/]+|victory-vendor)[\\/]/],
  ["vendor-tiptap", /[\\/]node_modules[\\/](@tiptap|prosemirror-[^\\/]+)[\\/]/],
];

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
  // En production : console.log / console.debug retirés (les avertissements et erreurs restent)
  esbuild: mode === 'production' ? { pure: ['console.log', 'console.debug'] } : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.indexOf("node_modules") === -1) return undefined;
          for (let i = 0; i < VENDOR_GROUPS.length; i++) {
            if (VENDOR_GROUPS[i][1].test(id)) return VENDOR_GROUPS[i][0];
          }
          return undefined;
        },
      },
    },
  },
}));
