import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import postcssSafari12 from "./postcss-safari12.js";

// Ordre important : Tailwind génère, Autoprefixer ajoute les préfixes -webkit-
// (selon "browserslist" dans package.json), puis postcss-safari12 réécrit les
// sélecteurs que Safari 12 (iPad iOS 12) ne comprend pas.
export default {
  plugins: [tailwindcss(), autoprefixer(), postcssSafari12()],
};
