# Fluidité des nouvelles fonctions (MathType, GeoGebra, Exams programmés, Exams)

Les fichiers sont déjà copiés dans le projet. Si besoin : `git apply fluidite.patch` ou `tar xzf fluidite.tgz` à la racine.

## À faire
1. **Supabase › SQL Editor** : lancer `supabase/migrations/20261121090000_perf_nouvelles_fonctions.sql`
   (index manquants + règles des tableaux blancs plus rapides ; aucun droit ne change ; relançable).
2. Rien à installer. `npm run build` passe.

## Ce qui change
- **Ouverture plus rapide de Word, Excel, PowerPoint et GeoGebra** : leur code commence à se télécharger
  dès qu'on survole/touche le lien (menu ou page d'accueil de l'outil). Sur la page GeoGebra, le script
  GeoGebra se télécharge pendant qu'on choisit l'application. Rien en mode « économie de données ».
- **Aperçu PDF des Devoirs maison / Exemples devoirs sur téléphone et tablette** : Android et iPad
  affichaient une page blanche (ou la 1re page seulement). Ils ont maintenant un bouton « Ouvrir le PDF ».
- **Outils Office sur téléphone** : la barre du bas (« Page 1 sur 1 / 0 mots ») passait sur deux lignes ;
  une bande vide de 24 px entre l'outil et la barre de navigation est supprimée (Word, Excel, PowerPoint,
  GeoGebra, PDF, messages).
- **Quiz programmés** : sous-titre et recherche propres aux quiz (avant : texte des examens).

## Contrôlé sans problème
- Poids des pages : les éditeurs lourds (MathLive 219 Ko, Excel 1,8 Mo, GeoGebra) ne sont chargés
  que sur leur page ; les pages Exams / Devoirs / GeoGebra / Office ajoutent moins de 15 Ko au socle.
- Affichage FR/AR, clair/sombre, ordinateur/téléphone des pages Exams, Quiz, Devoirs maison,
  Exemples devoirs, GeoGebra, Word (onglet Maths, éditeur d'équations) : pas de débordement horizontal,
  pas d'erreur dans la console.
