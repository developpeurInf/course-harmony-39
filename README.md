# Math infini

Application web (Next.js 16, App Router) pour les professeurs et les élèves : classes, cours, exercices, examens et quiz, évaluation diagnostique, rapports. Données et authentification via Supabase. Interface en français, arabe (RTL) et anglais.

## Démarrer en local

```sh
npm install
npm run dev        # http://localhost:8080
```

## Production

```sh
npm run build
npm start
```

Netlify détecte Next.js automatiquement (voir `netlify.toml`).

## Structure

- `src/app` : routes Next.js (layouts, pages, route `/api/download`)
- `src/views` : écrans de l'application
- `src/components` : composants (dont `ui/` pour les primitives)
- `src/contexts`, `src/hooks`, `src/lib` : état, logique et utilitaires
- `supabase/` : migrations et fonctions
