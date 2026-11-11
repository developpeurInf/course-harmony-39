/**
 * Ressources « proposées » (cours, exercices, examens) rangées comme le programme officiel
 * marocain : niveau → matière → partie → chapitre.
 *
 * Les documents sont des PDF originaux rédigés pour la plateforme et servis depuis
 * public/proposes/<niveau>/<matière>/. Un chapitre sans document s'affiche « bientôt ».
 * Pour ajouter un document : déposer le PDF dans public/proposes/... puis l'ajouter
 * dans `docs` du chapitre concerné.
 */
export type ProposedKind = "course" | "exercise" | "exam";
export type LevelKey = "tc" | "1bac" | "2bac";
export type SubjectKey = "pc" | "math" | "svt";

export interface ProposedDoc {
  kind: ProposedKind;
  title: string;
  /** chemin public du PDF */
  file: string;
  pages?: number;
  /** contient le corrigé */
  withSolution?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  part: string;
  docs?: ProposedDoc[];
}

export const LEVELS: { key: LevelKey; label: [string, string, string] }[] = [
  { key: "tc", label: ["Tronc commun sciences", "الجذع المشترك العلمي", "Common core"] },
  { key: "1bac", label: ["1re année Bac sciences", "الأولى باكالوريا علوم", "1st year Bac"] },
  { key: "2bac", label: ["2e année Bac PC / SM", "الثانية باكالوريا", "2nd year Bac"] },
];

export const SUBJECTS: { key: SubjectKey; label: [string, string, string] }[] = [
  { key: "pc", label: ["Physique-chimie", "الفيزياء والكيمياء", "Physics & chemistry"] },
  { key: "math", label: ["Mathématiques", "الرياضيات", "Mathematics"] },
  { key: "svt", label: ["SVT", "علوم الحياة والأرض", "Life & earth sciences"] },
];

const ch = (prefix: string, part: string, titles: string[]): Chapter[] =>
  titles.map((title, i) => ({ id: `${prefix}-${part.slice(0, 3).toLowerCase()}-${i + 1}`, title, part }));

const P = "/proposes/2bac/pc";

const PC_2BAC: Chapter[] = [
  {
    id: "2bac-pc-ondes-1",
    part: "Physique · Ondes",
    title: "Ondes mécaniques progressives",
    docs: [
      { kind: "course", title: "Cours : Ondes mécaniques progressives", file: `${P}/ondes-mecaniques-cours.pdf` },
      { kind: "exercise", title: "Série d'exercices corrigés : Ondes mécaniques progressives", file: `${P}/ondes-mecaniques-exercices.pdf`, withSolution: true },
      { kind: "exam", title: "Devoir surveillé n°1 type : les ondes (avec corrigé)", file: `${P}/ondes-devoir-1.pdf`, withSolution: true },
    ],
  },
  ...ch("2bac-pc", "Physique · Ondes", ["Ondes mécaniques progressives périodiques", "Propagation d'une onde lumineuse"]).map((c, i) => ({ ...c, id: `2bac-pc-ondes-${i + 2}` })),
  ...ch("2bac-pc", "Physique · Transformations nucléaires", ["Décroissance radioactive", "Noyaux, masse et énergie"]),
  ...ch("2bac-pc", "Physique · Électricité", ["Dipôle RC", "Dipôle RL", "Oscillations libres d'un circuit RLC série", "Ondes électromagnétiques et modulation d'amplitude"]),
  ...ch("2bac-pc", "Physique · Mécanique", ["Lois de Newton", "Chute verticale d'un solide", "Mouvements plans", "Satellites et planètes", "Mouvement de rotation d'un solide autour d'un axe fixe", "Systèmes mécaniques oscillants", "Aspects énergétiques des oscillations mécaniques"]),
  ...ch("2bac-pc", "Chimie · Transformations lentes et rapides", ["Transformations lentes et transformations rapides", "Suivi temporel d'une transformation : vitesse de réaction"]),
  ...ch("2bac-pc", "Chimie · Transformations non totales", ["Transformations chimiques s'effectuant dans les deux sens", "État d'équilibre d'un système chimique", "Transformations liées aux réactions acide-base", "Dosage acido-basique"]),
  ...ch("2bac-pc", "Chimie · Sens d'évolution d'un système", ["Évolution spontanée d'un système chimique", "Transformations spontanées dans les piles", "Transformations forcées : l'électrolyse"]),
  ...ch("2bac-pc", "Chimie · Contrôle de l'évolution", ["Réactions d'estérification et d'hydrolyse", "Contrôle de l'évolution des systèmes chimiques"]),
];

const PC_1BAC: Chapter[] = [
  ...ch("1bac-pc", "Physique · Mécanique", ["Rotation d'un corps solide autour d'un axe fixe", "Travail et puissance d'une force", "Travail et énergie cinétique", "Énergie potentielle de pesanteur et énergie mécanique", "Travail et énergie interne", "Énergie thermique et transfert thermique"]),
  ...ch("1bac-pc", "Physique · Électricité", ["Champ électrostatique", "Énergie potentielle électrostatique", "Transfert d'énergie dans un circuit électrique", "Comportement global d'un circuit électrique", "Champ magnétique", "Champ magnétique créé par un courant", "Forces électromagnétiques : loi de Laplace"]),
  ...ch("1bac-pc", "Physique · Optique", ["Conditions de visibilité d'un objet", "Images formées par un miroir plan", "Lentilles minces convergentes", "Instruments optiques"]),
  ...ch("1bac-pc", "Chimie · Mesure en chimie", ["Importance de la mesure en chimie", "Grandeurs physiques liées aux quantités de matière", "Concentration et solutions électrolytiques", "Suivi d'une transformation chimique", "Mesure de la conductance", "Réactions acido-basiques", "Réactions d'oxydoréduction", "Dosages directs"]),
  ...ch("1bac-pc", "Chimie · Chimie organique", ["Expansion de la chimie organique", "Lecture des formules et squelettes carbonés", "Groupes caractéristiques et réactivité"]),
];

const PC_TC: Chapter[] = [
  ...ch("tc-pc", "Physique · Mécanique", ["Gravitation universelle", "Exemples d'actions mécaniques", "Mouvement", "Principe d'inertie", "Équilibre d'un corps solide soumis à deux forces", "Équilibre d'un corps solide soumis à trois forces", "Équilibre d'un corps solide susceptible de tourner autour d'un axe fixe"]),
  ...ch("tc-pc", "Physique · Électricité", ["Courant électrique continu", "Tension électrique", "Association des conducteurs ohmiques", "Caractéristiques de quelques dipôles passifs", "Caractéristique d'un dipôle actif", "Le transistor", "L'amplificateur opérationnel"]),
  ...ch("tc-pc", "Chimie · Les espèces chimiques", ["Les espèces chimiques", "Extraction, séparation et identification d'espèces chimiques", "Synthèse des espèces chimiques"]),
  ...ch("tc-pc", "Chimie · Constitution de la matière", ["Le modèle de l'atome", "Géométrie de quelques molécules", "Classification périodique des éléments chimiques"]),
  ...ch("tc-pc", "Chimie · Transformations de la matière", ["La mole, unité de quantité de matière", "Concentration molaire des espèces en solution", "La transformation chimique d'un système", "Bilan de matière"]),
];

export const CATALOG: Partial<Record<LevelKey, Partial<Record<SubjectKey, Chapter[]>>>> = {
  tc: { pc: PC_TC },
  "1bac": { pc: PC_1BAC },
  "2bac": { pc: PC_2BAC },
};

export const chaptersFor = (level?: LevelKey | null, subject?: SubjectKey | null): Chapter[] =>
  (level && subject && CATALOG[level]?.[subject]) || [];

/** Devine le niveau et la matière d'après le nom de la classe (« 2BAC PC 3 », « TCS 1 », « 1BAC SE »…) */
export function guessFromRoom(name = "", description = ""): { level?: LevelKey; subject?: SubjectKey } {
  const s = `${name} ${description}`.toLowerCase();
  let level: LevelKey | undefined;
  if (/2\s*-?\s*bac|bac\s*2|2\s*ème\s*bac|2e\s*bac|الثانية\s*باك/.test(s)) level = "2bac";
  else if (/1\s*-?\s*bac|bac\s*1|1\s*ère\s*bac|1re\s*bac|الأولى\s*باك/.test(s)) level = "1bac";
  else if (/\btc\w*|tronc|common\s*core|الجذع/.test(s)) level = "tc";
  let subject: SubjectKey | undefined;
  if (/\bsvt\b|biolog|علوم الحياة/.test(s)) subject = "svt";
  else if (/\bmath|رياضيات/.test(s)) subject = "math";
  else if (/\bpc\b|physique|chimie|فيزياء/.test(s)) subject = "pc";
  return { level, subject };
}

export const KIND_LABEL: Record<ProposedKind, [string, string, string]> = {
  course: ["Cours proposés", "الدروس المقترحة", "Suggested courses"],
  exercise: ["Exercices proposés", "التمارين المقترحة", "Suggested exercises"],
  exam: ["Exams proposés", "الامتحانات المقترحة", "Suggested exams"],
};

export const KIND_PATH: Record<ProposedKind, string> = {
  course: "proposed-courses",
  exercise: "proposed-exercises",
  exam: "proposed-exams",
};
