import { DiagnosticClass, DiagnosticStudent } from "./diagnosticStatsEngine";

export interface DiagnosticExercise {
  titre: string;
  description: string;
}

export interface DiagnosticConfig {
  academie: string;
  direction: string;
  lycee: string;
  niveau_titre: string;
  nom_enseignant: string;
  matiere: string;
  niveau: string;
  annee_scolaire: string;
  periode_diagnostic: string;
  classes_concernees: string;
  classes_section_1: string;
  nombre_exercices_texte: string;
  exercices: DiagnosticExercise[];
  appreciation_globale: string;
  observations: string[];
  propositions: string[];
}

export interface DiagnosticAppData {
  config: DiagnosticConfig;
  classes: DiagnosticClass[];
}

const STORAGE_KEY = "diageval_pro_data_v1";

export const DEFAULT_DIAGNOSTIC_DATA: DiagnosticAppData = {
  config: {
    academie: "الأكاديمية الجهوية الرباط-سلا- القنيطرة",
    direction: "المديرية الإقليمية القنيطرة",
    lycee: "الثانوية التأهيلية محمد بنيس",
    niveau_titre: "2BAC-PC/SVT",
    nom_enseignant: "Jaouad Maataoui",
    matiere: "Mathématique",
    niveau: "2BPCF / 2BSVT",
    annee_scolaire: "2026 / 2027",
    periode_diagnostic: "01 au 09 octobre 2026",
    classes_concernees: "2Bac-PCF-1, 2Bac-PCF-2, 2Bac-SVT-1 et 2Bac-SVT-2",
    classes_section_1: "2Bac PC ET SVT",
    nombre_exercices_texte: "quatre",
    exercices: [
      {
        titre: "Exercice 1",
        description: "Calcul numérique (calcul numérique, factorisation, identité remarquable)"
      },
      {
        titre: "Exercice 2",
        description: "Limité – Dérivabilité- Etude des fonctions – représentation graphique"
      },
      {
        titre: "Exercice 3",
        description: "Les suites numérique (suite arithmétique, suite géométrique…)"
      },
      {
        titre: "Exercice 4",
        description: "Notion de logique"
      }
    ],
    appreciation_globale: "médiocres",
    observations: [
      "Tous les apprenants ont des difficultés avec le calcul de la limite.",
      "Tous les apprenants n’ont pas maîtrisé les propriétés de dérivation.",
      "Nombreux sont les élèves qui n’ont pas la possibilité de déterminer le domaine de définition d’une fonction numérique.",
      "Tous les apprenants ne sont pas capables de  lire la courbe de la fonction.",
      "Tous les apprenants ont des grands problèmes avec les suites et les types de raisonnement."
    ],
    propositions: [
      "Rappeler les notions des limites, et des suites, intervenir des techniques sur la lecture de  la courbe d’une fonction.",
      "Expliquer le principe de dérivation ( la majorité des élèves n’ont aucune idée sur la dérivation)",
      "Réaliser le soutien (exercices sur les limites, la dérivation, les suites et les fonctions) avec les apprenants en tant que solution d’intervention pour remédier, rattraper, corriger, et combler les lacunes.",
      "Intervenir même dans les séances des cours programmé pour la 2bac quelques minutes pour rattraper et corrigé les fausses représentations."
    ]
  },
  classes: []
};

// Old default values — used to detect and migrate stale localStorage
const OLD_DEFAULTS = {
  academie: "الأكاديمية الجهوية سوس ماسة",
  direction: "المديرية الإقليمية تارودانت",
  lycee: "ثانوية النهضة التأهيلية-أولاد تايمة",
  annee_scolaire_list: ["2024 / 2025", "2025 / 2026"],
};

function migrateData(data: DiagnosticAppData): DiagnosticAppData {
  const cfg = data.config;
  const isOldAcademie = cfg.academie === OLD_DEFAULTS.academie;
  const isOldDirection = cfg.direction === OLD_DEFAULTS.direction;
  const isOldLycee = cfg.lycee === OLD_DEFAULTS.lycee;
  const isOldAnnee = OLD_DEFAULTS.annee_scolaire_list.includes(cfg.annee_scolaire);

  if (isOldAcademie || isOldDirection || isOldLycee || isOldAnnee) {
    const migrated: DiagnosticAppData = {
      ...data,
      config: {
        ...cfg,
        academie: isOldAcademie ? DEFAULT_DIAGNOSTIC_DATA.config.academie : cfg.academie,
        direction: isOldDirection ? DEFAULT_DIAGNOSTIC_DATA.config.direction : cfg.direction,
        lycee: isOldLycee ? DEFAULT_DIAGNOSTIC_DATA.config.lycee : cfg.lycee,
        annee_scolaire: isOldAnnee ? DEFAULT_DIAGNOSTIC_DATA.config.annee_scolaire : cfg.annee_scolaire,
      },
    };
    saveDiagnosticData(migrated);
    return migrated;
  }
  return data;
}

export function loadDiagnosticData(): DiagnosticAppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveDiagnosticData(DEFAULT_DIAGNOSTIC_DATA);
      return JSON.parse(JSON.stringify(DEFAULT_DIAGNOSTIC_DATA));
    }
    const parsed = JSON.parse(raw);
    if (!parsed.config || !Array.isArray(parsed.classes)) {
      saveDiagnosticData(DEFAULT_DIAGNOSTIC_DATA);
      return JSON.parse(JSON.stringify(DEFAULT_DIAGNOSTIC_DATA));
    }
    return migrateData(parsed);
  } catch (e) {
    console.error("Erreur lors du chargement des données diagnostiques:", e);
    return JSON.parse(JSON.stringify(DEFAULT_DIAGNOSTIC_DATA));
  }
}

export function saveDiagnosticData(data: DiagnosticAppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Erreur lors de la sauvegarde des données diagnostiques:", e);
  }
}

export function resetDiagnosticDataToDefaults(): DiagnosticAppData {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_DIAGNOSTIC_DATA));
  saveDiagnosticData(defaults);
  return defaults;
}
