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
  /** cours : version complète ou résumé */
  variant?: "full" | "summary";
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

const P = "/proposes/2bac/pc";

/** chapitres dont le cours complet est rédigé (fichier <base>-cours-complet.pdf) */
const FULL_COURSES = new Set<string>(["ondes-mecaniques", "periodiques", "lumiere", "radio", "energie", "rc", "rl", "rlc", "modulation", "newton", "chute", "plans", "satellites", "rotation", "oscillants", "energie-meca", "lentes", "vitesse", "deux-sens", "equilibre", "acide-base", "dosage", "evolution", "piles", "electrolyse", "esterification", "controle"]);

const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ch = (prefix: string, part: string, titles: string[]): Chapter[] =>
  titles.map((title) => ({ id: `${prefix}-${slug(title)}`, title, part }));
/** chapitre avec cours + série d'exercices corrigés */
const full = (id: string, part: string, title: string, base: string, exTitle = title): Chapter => ({
  id, part, title,
  docs: [
    ...(FULL_COURSES.has(base) ? [{ kind: "course" as const, variant: "full" as const, title: `Cours complet : ${title}`, file: `${P}/${base}-cours-complet.pdf` }] : []),
    { kind: "course", variant: "summary", title: `Résumé : ${title}`, file: `${P}/${base}-cours.pdf` },
    { kind: "exercise", title: `Série d'exercices corrigés : ${exTitle}`, file: `${P}/${base}-exercices.pdf`, withSolution: true },
  ],
});

const withExam = (c: Chapter, ...extra: ProposedDoc[]): Chapter => ({ ...c, docs: [...(c.docs || []), ...extra] });

const PC_2BAC: Chapter[] = [
  withExam(full("2bac-pc-ondes-1", "Physique · Ondes", "Ondes mécaniques progressives", "ondes-mecaniques"),
    { kind: "exam", title: "Devoir surveillé n°1 type : ondes mécaniques (avec corrigé)", file: `${P}/ondes-devoir-1.pdf`, withSolution: true }),
  full("2bac-pc-ondes-2", "Physique · Ondes", "Ondes mécaniques progressives périodiques", "periodiques", "Ondes périodiques"),
  full("2bac-pc-ondes-3", "Physique · Ondes", "Propagation d'une onde lumineuse", "lumiere", "Ondes lumineuses"),
  full("2bac-pc-nuc-1", "Physique · Transformations nucléaires", "Décroissance radioactive", "radio"),
  full("2bac-pc-nuc-2", "Physique · Transformations nucléaires", "Noyaux, masse et énergie", "energie"),
  full("2bac-pc-ele-1", "Physique · Électricité", "Dipôle RC", "rc"),
  full("2bac-pc-ele-2", "Physique · Électricité", "Dipôle RL", "rl"),
  full("2bac-pc-ele-3", "Physique · Électricité", "Oscillations libres d'un circuit RLC série", "rlc", "Circuit RLC série"),
  full("2bac-pc-ele-4", "Physique · Électricité", "Ondes électromagnétiques et modulation d'amplitude", "modulation", "Modulation d'amplitude"),
  full("2bac-pc-meca-1", "Physique · Mécanique", "Lois de Newton", "newton"),
  full("2bac-pc-meca-2", "Physique · Mécanique", "Chute verticale d'un solide", "chute"),
  full("2bac-pc-meca-3", "Physique · Mécanique", "Mouvements plans", "plans"),
  full("2bac-pc-meca-4", "Physique · Mécanique", "Satellites et planètes", "satellites"),
  full("2bac-pc-meca-5", "Physique · Mécanique", "Mouvement de rotation d'un solide autour d'un axe fixe", "rotation", "Rotation autour d'un axe fixe"),
  full("2bac-pc-meca-6", "Physique · Mécanique", "Systèmes mécaniques oscillants", "oscillants"),
  full("2bac-pc-meca-7", "Physique · Mécanique", "Aspects énergétiques des oscillations mécaniques", "energie-meca", "Énergie des oscillateurs"),
  full("2bac-pc-chi-1", "Chimie · Transformations lentes et rapides", "Transformations lentes et transformations rapides", "lentes"),
  full("2bac-pc-chi-2", "Chimie · Transformations lentes et rapides", "Suivi temporel d'une transformation : vitesse de réaction", "vitesse"),
  full("2bac-pc-chi-3", "Chimie · Transformations non totales", "Transformations chimiques s'effectuant dans les deux sens", "deux-sens"),
  full("2bac-pc-chi-4", "Chimie · Transformations non totales", "État d'équilibre d'un système chimique", "equilibre"),
  full("2bac-pc-chi-5", "Chimie · Transformations non totales", "Transformations liées aux réactions acide-base", "acide-base"),
  full("2bac-pc-chi-6", "Chimie · Transformations non totales", "Dosage acido-basique", "dosage"),
  full("2bac-pc-chi-7", "Chimie · Sens d'évolution d'un système", "Évolution spontanée d'un système chimique", "evolution"),
  full("2bac-pc-chi-8", "Chimie · Sens d'évolution d'un système", "Transformations spontanées dans les piles", "piles"),
  full("2bac-pc-chi-9", "Chimie · Sens d'évolution d'un système", "Transformations forcées : l'électrolyse", "electrolyse"),
  full("2bac-pc-chi-10", "Chimie · Contrôle de l'évolution", "Réactions d'estérification et d'hydrolyse", "esterification"),
  full("2bac-pc-chi-11", "Chimie · Contrôle de l'évolution", "Contrôle de l'évolution des systèmes chimiques", "controle"),
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


/* ---------- Mathématiques 2BAC sciences expérimentales ---------- */
const PM = "/proposes/2bac/math";
/** chapitres de maths rédigés : cours complet + résumé + série corrigée */
const MATH_DONE = new Set<string>(["limites", "derivation", "suites", "primitives", "logarithme", "complexes-1", "exponentielle", "equa-diff", "complexes-2", "integrale", "produit-scalaire", "produit-vectoriel", "denombrement", "probabilites"]);
const fullM = (n: number, part: string, title: string, base: string): Chapter => ({
  id: `2bac-math-${n}`, part, title,
  docs: MATH_DONE.has(base) ? [
    { kind: "course", variant: "full", title: `Cours complet : ${title}`, file: `${PM}/${base}-cours-complet.pdf` },
    { kind: "course", variant: "summary", title: `Résumé : ${title}`, file: `${PM}/${base}-cours.pdf` },
    { kind: "exercise", title: `Série d'exercices corrigés : ${title}`, file: `${PM}/${base}-exercices.pdf`, withSolution: true },
  ] : undefined,
});
const AN = "Analyse", AG = "Algèbre et géométrie", PR = "Dénombrement et probabilités";
const MATH_2BAC: Chapter[] = [
  fullM(1, AN, "Limites et continuité", "limites"),
  fullM(2, AN, "Dérivation et étude des fonctions", "derivation"),
  fullM(3, AN, "Suites numériques", "suites"),
  fullM(4, AN, "Fonctions primitives", "primitives"),
  fullM(5, AN, "Fonctions logarithmiques", "logarithme"),
  fullM(6, AG, "Nombres complexes (partie 1)", "complexes-1"),
  fullM(7, AN, "Fonctions exponentielles", "exponentielle"),
  fullM(8, AN, "Équations différentielles", "equa-diff"),
  fullM(9, AG, "Nombres complexes (partie 2)", "complexes-2"),
  fullM(10, AN, "Calcul intégral", "integrale"),
  fullM(11, AG, "Produit scalaire dans l'espace et applications", "produit-scalaire"),
  fullM(12, AG, "Produit vectoriel", "produit-vectoriel"),
  fullM(13, PR, "Dénombrement", "denombrement"),
  fullM(14, PR, "Probabilités", "probabilites"),
];

/* ---------- SVT 2BAC sciences expérimentales (option SVT ; les élèves PC suivent une partie) ---------- */
const PS = "/proposes/2bac/svt";
/** chapitres de SVT rédigés : cours complet + résumé + série corrigée */
const SVT_DONE = new Set<string>(["energie", "muscle", "info-genetique", "expression", "genie-genetique", "meiose", "lois-mendel", "genetique-humaine", "genetique-populations", "environnement", "chaines-montagnes", "metamorphisme", "granitisation"]);
const fullS = (n: number, part: string, title: string, base: string): Chapter => ({
  id: `2bac-svt-${n}`, part, title,
  docs: SVT_DONE.has(base) ? [
    { kind: "course", variant: "full", title: `Cours complet : ${title}`, file: `${PS}/${base}-cours-complet.pdf` },
    { kind: "course", variant: "summary", title: `Résumé : ${title}`, file: `${PS}/${base}-cours.pdf` },
    { kind: "exercise", title: `Série d'exercices corrigés : ${title}`, file: `${PS}/${base}-exercices.pdf`, withSolution: true },
  ] : undefined,
});
const EN = "Consommation de la matière organique et flux d'énergie", GE = "Information génétique et génétique",
  EV = "Utilisation des matières organiques et inorganiques", GO = "Géologie : formation des chaînes de montagnes";
const SVT_2BAC: Chapter[] = [
  fullS(1, EN, "Libération de l'énergie emmagasinée dans la matière organique", "energie"),
  fullS(2, EN, "Rôle du muscle strié squelettique dans la conversion de l'énergie", "muscle"),
  fullS(3, GE, "Notion de l'information génétique", "info-genetique"),
  fullS(4, GE, "Expression de l'information génétique", "expression"),
  fullS(5, GE, "Le génie génétique", "genie-genetique"),
  fullS(6, GE, "Transfert de l'information génétique par la reproduction sexuée", "meiose"),
  fullS(7, GE, "Lois statistiques de transmission des caractères héréditaires", "lois-mendel"),
  fullS(8, GE, "La génétique humaine", "genetique-humaine"),
  fullS(9, GE, "La génétique des populations", "genetique-populations"),
  fullS(10, EV, "Ordures ménagères, pollution et contrôle de la qualité des milieux", "environnement"),
  fullS(11, GO, "Les chaînes de montagnes récentes et la tectonique des plaques", "chaines-montagnes"),
  fullS(12, GO, "Le métamorphisme", "metamorphisme"),
  fullS(13, GO, "La granitisation", "granitisation"),
];

const PM1 = "/proposes/1bac/math";
const MATH1_DONE = new Set<string>(["logique", "generalites-fonctions", "suites", "barycentre", "produit-scalaire", "trigonometrie", "rotation", "limites", "derivation", "representation-graphique", "vecteurs-espace", "geometrie-espace"]);
const fullM1 = (n: number, part: string, title: string, base: string): Chapter => ({ id: `1bac-math-${n}`, part, title,
  docs: MATH1_DONE.has(base) ? [ { kind: "course", variant: "full", title: `Cours complet : ${title}`, file: `${PM1}/${base}-cours-complet.pdf` },
    { kind: "course", variant: "summary", title: `Résumé : ${title}`, file: `${PM1}/${base}-cours.pdf` },
    { kind: "exercise", title: `Série d'exercices corrigés : ${title}`, file: `${PM1}/${base}-exercices.pdf`, withSolution: true } ] : undefined });
const A1 = "Analyse", G1 = "Géométrie", L1 = "Logique et calcul";
const MATH_1BAC: Chapter[] = [ fullM1(1, L1, "Notions de logique", "logique"), fullM1(2, A1, "Généralités sur les fonctions", "generalites-fonctions"),
  fullM1(3, A1, "Les suites numériques", "suites"), fullM1(4, G1, "Le barycentre dans le plan", "barycentre"),
  fullM1(5, G1, "Produit scalaire dans le plan", "produit-scalaire"), fullM1(6, L1, "Calcul trigonométrique", "trigonometrie"),
  fullM1(7, G1, "La rotation", "rotation"), fullM1(8, A1, "Limite d'une fonction numérique", "limites"),
  fullM1(9, A1, "La dérivation", "derivation"), fullM1(10, A1, "Représentation graphique d'une fonction numérique", "representation-graphique"),
  fullM1(11, G1, "Vecteurs de l'espace", "vecteurs-espace"), fullM1(12, G1, "Géométrie analytique dans l'espace", "geometrie-espace") ];

export const CATALOG: Partial<Record<LevelKey, Partial<Record<SubjectKey, Chapter[]>>>> = {
  tc: { pc: PC_TC },
  "1bac": { pc: PC_1BAC, math: MATH_1BAC },
  "2bac": { pc: PC_2BAC, math: MATH_2BAC, svt: SVT_2BAC },
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
