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
    academie: "الأكاديمية الجهوية سوس ماسة",
    direction: "المديرية الإقليمية تارودانت",
    lycee: "ثانوية النهضة التأهيلية-أولاد تايمة",
    niveau_titre: "2BAC-PC/SVT",
    nom_enseignant: "Jaouad Maataoui",
    matiere: "Mathématique",
    niveau: "2BPCF / 2BSVT",
    annee_scolaire: "2024 / 2025",
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
  classes: [
    {
      id: "c1",
      nom: "2Bac.PCF 1",
      date: "06-10-2024",
      students: [
        { id: 1, num: 1, massar: "M130001", name: "ALAMI MOHAMMED", note: 18.0 },
        { id: 2, num: 2, massar: "M130002", name: "BENNANI SALMA", note: 7.0 },
        { id: 3, num: 3, massar: "M130003", name: "CHRAIBI YOUSSEF", note: 6.5 },
        { id: 4, num: 4, massar: "M130004", name: "DAOUDI FATIMA ZAHRA", note: 11.0 },
        { id: 5, num: 5, massar: "M130005", name: "EL FASSI OMAR", note: 13.5 },
        { id: 6, num: 6, massar: "M130006", name: "IDRISSI HOUDA", note: 16.0 },
        { id: 7, num: 7, massar: "M130007", name: "KABBAJ HAMZA", note: 4.0 },
        { id: 8, num: 8, massar: "M130008", name: "LAHLOU KENZA", note: 7.5 },
        { id: 9, num: 9, massar: "M130009", name: "MANSOURI AMINE", note: null },
        { id: 10, num: 10, massar: "M130010", name: "NACIRI MERIEM", note: 7.5 }
      ]
    },
    {
      id: "c2",
      nom: "2Bac.PCF 2",
      date: "07-10-2024",
      students: [
        { id: 1, num: 1, massar: "M130011", name: "OUAZZANI REDA", note: 12.5 },
        { id: 2, num: 2, massar: "M130012", name: "QADIRI ASMAA", note: 14.5 },
        { id: 3, num: 3, massar: "M130013", name: "RAHMANI ANAS", note: 9.5 },
        { id: 4, num: 4, massar: "M130014", name: "SEBTI ZINEB", note: 10.0 },
        { id: 5, num: 5, massar: "M130015", name: "TAZI WALID", note: 6.0 },
        { id: 6, num: 6, massar: "M130016", name: "YAZAMI IMANE", note: 8.0 },
        { id: 7, num: 7, massar: "M130017", name: "ZAHIR MEHDI", note: 15.0 },
        { id: 8, num: 8, massar: "M130018", name: "BOUZID DOUAA", note: 11.5 }
      ]
    },
    {
      id: "c3",
      nom: "2Bac.SVT 1",
      date: "08-10-2024",
      students: [
        { id: 1, num: 1, massar: "M130019", name: "CHAKIR SAAD", note: 7.0 },
        { id: 2, num: 2, massar: "M130020", name: "EL AMRI SOUKAINA", note: 5.5 },
        { id: 3, num: 3, massar: "M130021", name: "FILALI ISMAIL", note: 9.0 },
        { id: 4, num: 4, massar: "M130022", name: "HASSANI NADA", note: 12.5 },
        { id: 5, num: 5, massar: "M130023", name: "JAAFARI AYMANE", note: 6.0 },
        { id: 6, num: 6, massar: "M130024", name: "KHLIFI HIBA", note: 10.5 },
        { id: 7, num: 7, massar: "M130025", name: "MOKHTARI RAYAN", note: 4.5 }
      ]
    },
    {
      id: "c4",
      nom: "2Bac.SVT 2",
      date: "---------------------",
      students: [
        { id: 1, num: 1, massar: "M13100000", name: "ALAMI MOHAMMED", note: 6.5 },
        { id: 2, num: 2, massar: "M13100001", name: "BENNANI SALMA", note: 7.0 },
        { id: 3, num: 3, massar: "M13100002", name: "CHRAIBI YOUSSEF", note: 5.0 },
        { id: 4, num: 4, massar: "M13100003", name: "DAOUDI FATIMA ZAHRA", note: 11.0 },
        { id: 5, num: 5, massar: "M13100004", name: "EL FASSI OMAR", note: 13.5 },
        { id: 6, num: 6, massar: "M13100005", name: "IDRISSI HOUDA", note: 16.0 },
        { id: 7, num: 7, massar: "M13100006", name: "KABBAJ HAMZA", note: 4.5 },
        { id: 8, num: 8, massar: "M13100007", name: "LAHLOU KENZA", note: 7.5 },
        { id: 9, num: 9, massar: "M13100008", name: "MANSOURI AMINE", note: 9.0 },
        { id: 10, num: 10, massar: "M13100009", name: "NACIRI MERIEM", note: 10.5 },
        { id: 11, num: 11, massar: "M13100010", name: "OUAZZANI REDA", note: 14.0 },
        { id: 12, num: 12, massar: "M13100011", name: "QADIRI ASMAA", note: 15.5 },
        { id: 13, num: 13, massar: "M13100012", name: "RAHMANI ANAS", note: 6.0 },
        { id: 14, num: 14, massar: "M13100013", name: "SEBTI ZINEB", note: 8.0 },
        { id: 15, num: 15, massar: "M13100014", name: "TAZI WALID", note: 11.5 },
        { id: 16, num: 16, massar: "M13100015", name: "YAZAMI IMANE", note: 12.0 },
        { id: 17, num: 17, massar: "M13100016", name: "ZAHIR MEHDI", note: 7.0 },
        { id: 18, num: 18, massar: "M13100017", name: "BOUZID DOUAA", note: 5.5 },
        { id: 19, num: 19, massar: "M13100018", name: "CHAKIR SAAD", note: 10.0 },
        { id: 20, num: 20, massar: "M13100019", name: "EL AMRI SOUKAINA", note: 13.0 },
        { id: 21, num: 21, massar: "M13100020", name: "FILALI ISMAIL", note: 17.0 },
        { id: 22, num: 22, massar: "M13100021", name: "HASSANI NADA", note: 8.5 },
        { id: 23, num: 23, massar: "M13100022", name: "JAAFARI AYMANE", note: 6.0 },
        { id: 24, num: 24, massar: "M13100023", name: "KHLIFI HIBA", note: 10.5 },
        { id: 25, num: 25, massar: "M13100024", name: "MOKHTARI RAYAN", note: null }
      ]
    }
  ]
};

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
    return parsed;
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
