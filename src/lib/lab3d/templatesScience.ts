/**
 * Modèles du Labo 3D pour la physique, la chimie et les SVT (programme marocain du lycée).
 */
import type { ParamDef, Tri } from "./templates";

const T = (fr: string, ar: string, en: string): Tri => ({ fr, ar, en });
const num = (key: string, label: Tri, min: number, max: number, step: number, def: number, student = true): ParamDef =>
  ({ key, type: "number", label, min, max, step, def, student });
const bool = (key: string, label: Tri, def: boolean, student = true): ParamDef => ({ key, type: "bool", label, def, student });
const sel = (key: string, label: Tri, def: string, options: [string, Tri][], student = true): ParamDef =>
  ({ key, type: "select", label, def, student, options: options.map(([v, l]) => ({ v, label: l })) });
const labels = bool("labels", T("Légendes", "التسميات", "Labels"), true);

export type ScienceGroup = "physics" | "chemistry" | "svt";
export interface ScienceTemplate {
  id: string; group: ScienceGroup; icon: string; level: string; label: Tri; desc: Tri; params: ParamDef[]; animated?: boolean;
}

export const SCIENCE_TEMPLATES: ScienceTemplate[] = [
  // ------------------------------------------------------------------ physique
  {
    id: "pendulum", group: "physics", icon: "🕰️", level: "1re Bac · 2e Bac", animated: true,
    label: T("Pendule simple", "النواس البسيط", "Simple pendulum"),
    desc: T("Oscillations, période propre T₀ = 2π√(L/g), amortissement et échanges d'énergie.", "التذبذبات والدور الخاص والتخميد وتبادل الطاقة.", "Oscillations, natural period, damping and energy exchange."),
    params: [
      num("L", T("Longueur du fil L (m)", "طول الخيط L (م)", "String length L (m)"), 0.2, 3, 0.05, 1),
      num("theta", T("Angle initial θ₀ (°)", "الزاوية البدئية θ₀", "Initial angle θ₀ (°)"), 2, 80, 1, 20),
      num("g", T("Intensité de pesanteur g (N/kg)", "شدة الثقالة g", "Gravity g (N/kg)"), 1.6, 25, 0.1, 9.8),
      num("damping", T("Frottements", "الاحتكاكات", "Friction"), 0, 1, 0.01, 0),
      bool("energy", T("Barres d'énergie (Ec, Epp, Em)", "أعمدة الطاقة", "Energy bars"), true),
      bool("trace", T("Tracer la trajectoire", "رسم المسار", "Trace the path"), false),
    ],
  },
  {
    id: "spring", group: "physics", icon: "🌀", level: "1re Bac · 2e Bac", animated: true,
    label: T("Oscillateur masse-ressort", "المتذبذب جسم-نابض", "Mass-spring oscillator"),
    desc: T("Pendule élastique horizontal : T₀ = 2π√(m/k), amortissement, énergie mécanique.", "النواس المرن الأفقي والدور الخاص والطاقة الميكانيكية.", "Horizontal spring pendulum, period, damping, mechanical energy."),
    params: [
      num("k", T("Raideur k (N/m)", "صلابة النابض k", "Stiffness k (N/m)"), 5, 200, 1, 20),
      num("m", T("Masse m (kg)", "الكتلة m", "Mass m (kg)"), 0.05, 2, 0.01, 0.2),
      num("A", T("Amplitude initiale (cm)", "الوسع البدئي (سم)", "Initial amplitude (cm)"), 1, 20, 0.5, 8),
      num("damping", T("Frottements", "الاحتكاكات", "Friction"), 0, 1, 0.01, 0),
      bool("energy", T("Barres d'énergie", "أعمدة الطاقة", "Energy bars"), true),
      bool("graph", T("Courbe x(t)", "المنحنى x(t)", "x(t) curve"), true),
    ],
  },
  {
    id: "projectile", group: "physics", icon: "🏀", level: "2e Bac", animated: true,
    label: T("Mouvement d'un projectile", "حركة قذيفة", "Projectile motion"),
    desc: T("Mouvement plan dans le champ de pesanteur : trajectoire parabolique, portée, flèche, composantes de la vitesse.", "الحركة في مجال الثقالة: المسار والمدى والذروة.", "Motion in a uniform gravity field: parabola, range, maximum height."),
    params: [
      num("v0", T("Vitesse initiale v₀ (m/s)", "السرعة البدئية v₀", "Initial speed v₀ (m/s)"), 1, 40, 0.5, 15),
      num("alpha", T("Angle de tir α (°)", "زاوية القذف α", "Launch angle α (°)"), 0, 90, 1, 45),
      num("h0", T("Hauteur de départ (m)", "ارتفاع الانطلاق", "Launch height (m)"), 0, 20, 0.5, 0),
      num("g", T("g (N/kg)", "g", "g (N/kg)"), 1.6, 25, 0.1, 9.8),
      bool("vectors", T("Vecteur vitesse et composantes", "متجهة السرعة ومركبتاها", "Velocity vector and components"), true),
      bool("compare", T("Comparer avec α et 90° − α", "مقارنة مع 90° − α", "Compare with 90° − α"), false),
    ],
  },
  {
    id: "fall", group: "physics", icon: "🪂", level: "2e Bac", animated: true,
    label: T("Chute verticale avec frottement", "السقوط الرأسي باحتكاك", "Vertical fall with drag"),
    desc: T("Chute libre ou freinée par l'air : vitesse limite, temps caractéristique, méthode d'Euler.", "السقوط الحر أو باحتكاك: السرعة الحدية والزمن المميز.", "Free fall or with air drag: terminal velocity, time constant."),
    params: [
      sel("model", T("Frottement", "الاحتكاك", "Drag"), "quad", [["none", T("Aucun (chute libre)", "بدون (سقوط حر)", "None (free fall)")], ["lin", T("f = k·v", "f = k·v", "f = k·v")], ["quad", T("f = k·v²", "f = k·v²", "f = k·v²")]]),
      num("m", T("Masse m (kg)", "الكتلة m", "Mass m (kg)"), 0.01, 5, 0.01, 0.5),
      num("k", T("Coefficient k", "المعامل k", "Coefficient k"), 0.001, 2, 0.001, 0.05),
      num("H", T("Hauteur de chute (m)", "ارتفاع السقوط", "Drop height (m)"), 5, 200, 1, 60),
      bool("graph", T("Courbe v(t)", "المنحنى v(t)", "v(t) curve"), true),
    ],
  },
  {
    id: "orbit", group: "physics", icon: "🛰️", level: "TC · 2e Bac", animated: true,
    label: T("Satellites et planètes", "الأقمار الاصطناعية والكواكب", "Satellites and planets"),
    desc: T("Gravitation universelle, mouvement circulaire uniforme, 3e loi de Kepler, satellite géostationnaire, loi des aires.", "التجاذب الكوني والحركة الدائرية وقوانين كيبلر.", "Universal gravitation, circular motion, Kepler's laws, geostationary satellite."),
    params: [
      sel("body", T("Astre attracteur", "الجسم الجاذب", "Central body"), "earth", [["earth", T("Terre", "الأرض", "Earth")], ["sun", T("Soleil (planètes)", "الشمس (الكواكب)", "Sun (planets)")]]),
      num("h", T("Altitude du satellite h (km)", "ارتفاع القمر الاصطناعي h (كم)", "Satellite altitude h (km)"), 200, 40000, 100, 800),
      sel("planet", T("Planète (si Soleil)", "الكوكب (في حالة الشمس)", "Planet (if Sun)"), "earth", [["mercury", T("Mercure", "عطارد", "Mercury")], ["venus", T("Vénus", "الزهرة", "Venus")], ["earth", T("Terre", "الأرض", "Earth")], ["mars", T("Mars", "المريخ", "Mars")], ["jupiter", T("Jupiter", "المشتري", "Jupiter")], ["saturn", T("Saturne", "زحل", "Saturn")]]),
      num("e", T("Excentricité (0 = cercle)", "الاختلاف المركزي", "Eccentricity (0 = circle)"), 0, 0.8, 0.01, 0),
      bool("vectors", T("Force et vitesse", "القوة والسرعة", "Force and velocity"), true),
      bool("areas", T("Loi des aires (Kepler 2)", "قانون المساحات", "Law of areas"), false),
      bool("geo", T("Comparer à l'orbite géostationnaire", "مقارنة مع المدار الثابت بالنسبة للأرض", "Compare to geostationary orbit"), false),
    ],
  },
  {
    id: "wave", group: "physics", icon: "🌊", level: "2e Bac", animated: true,
    label: T("Ondes mécaniques", "الموجات الميكانيكية", "Mechanical waves"),
    desc: T("Onde le long d'une corde, d'un ressort, à la surface de l'eau ; longueur d'onde λ = v/N, interférences, diffraction.", "موجة على حبل أو نابض أو سطح الماء، طول الموجة والتداخل والحيود.", "Waves on a rope, a spring, water; wavelength, interference, diffraction."),
    params: [
      sel("kind", T("Situation", "الوضعية", "Situation"), "water", [["rope", T("Corde (transversale)", "حبل (مستعرضة)", "Rope (transverse)")], ["spring", T("Ressort (longitudinale)", "نابض (طولية)", "Spring (longitudinal)")], ["water", T("Cuve à ondes (circulaire)", "حوض الموجات (دائرية)", "Ripple tank (circular)")], ["two", T("Deux sources (interférences)", "منبعان (تداخل)", "Two sources (interference)")], ["slit", T("Fente (diffraction)", "شق (حيود)", "Slit (diffraction)")]]),
      num("N", T("Fréquence N (Hz)", "التردد N", "Frequency N (Hz)"), 0.2, 3, 0.05, 1),
      num("v", T("Célérité v (m/s)", "سرعة الانتشار v", "Speed v (m/s)"), 0.5, 4, 0.05, 2),
      num("A", T("Amplitude", "الوسع", "Amplitude"), 0.05, 0.6, 0.01, 0.25),
      num("a", T("Largeur de la fente / écart des sources (m)", "عرض الشق / المسافة بين المنبعين", "Slit width / source spacing (m)"), 0.3, 4, 0.05, 1.5),
      bool("pause", T("Figer l'onde (instantané)", "تجميد الموجة", "Freeze the wave"), false),
    ],
  },
  {
    id: "lens", group: "physics", icon: "🔍", level: "1re Bac", animated: false,
    label: T("Lentille mince : construction d'image", "العدسة الرقيقة: إنشاء الصورة", "Thin lens: image construction"),
    desc: T("Rayons particuliers, foyers, relation de conjugaison 1/OA' − 1/OA = 1/f', grandissement, loupe.", "الأشعة الخاصة والبؤر وعلاقة المرافقة والتكبير.", "Particular rays, focal points, lens equation, magnification."),
    params: [
      sel("type", T("Lentille", "العدسة", "Lens"), "conv", [["conv", T("Convergente", "مجمعة", "Converging")], ["div", T("Divergente", "مفرقة", "Diverging")]]),
      num("f", T("Distance focale |f'| (cm)", "المسافة البؤرية (سم)", "Focal length (cm)"), 3, 30, 0.5, 10),
      num("OA", T("Position de l'objet OA (cm, négatif = à gauche)", "موضع الشيء OA (سم)", "Object position OA (cm)"), -60, -1, 0.5, -30),
      num("AB", T("Taille de l'objet AB (cm)", "طول الشيء AB", "Object size AB (cm)"), 1, 10, 0.5, 4),
      bool("rays", T("Rayons particuliers", "الأشعة الخاصة", "Particular rays"), true),
    ],
  },
  {
    id: "dispersion", group: "physics", icon: "🌈", level: "2e Bac", animated: false,
    label: T("Dispersion par un prisme", "تبدد الضوء بموشور", "Dispersion by a prism"),
    desc: T("La lumière blanche se décompose : l'indice dépend de la longueur d'onde (loi de Cauchy).", "تبدد الضوء الأبيض: المعامل يتعلق بطول الموجة.", "White light splits: refractive index depends on wavelength."),
    params: [
      num("A", T("Angle du prisme A (°)", "زاوية الموشور A", "Prism angle A (°)"), 30, 70, 1, 60),
      num("i", T("Angle d'incidence i (°)", "زاوية الورود i", "Incidence angle i (°)"), 20, 80, 1, 50),
      num("n", T("Indice pour le jaune", "المعامل للأصفر", "Index for yellow"), 1.4, 1.9, 0.01, 1.62),
      sel("light", T("Lumière", "الضوء", "Light"), "white", [["white", T("Blanche", "بيضاء", "White")], ["red", T("Monochromatique rouge", "أحادية حمراء", "Red only")], ["blue", T("Monochromatique bleue", "أحادية زرقاء", "Blue only")]]),
    ],
  },
  {
    id: "magnet", group: "physics", icon: "🧲", level: "1re Bac", animated: true,
    label: T("Champ magnétique", "المجال المغنطيسي", "Magnetic field"),
    desc: T("Lignes de champ d'un aimant, d'un fil, d'une bobine (solénoïde), aiguilles aimantées et force de Laplace.", "خطوط المجال لمغنطيس وسلك ووشيعة وقوة لابلاس.", "Field lines of a magnet, wire, solenoid, compasses and Laplace force."),
    params: [
      sel("source", T("Source", "المصدر", "Source"), "magnet", [["magnet", T("Aimant droit", "مغنطيس مستقيم", "Bar magnet")], ["wire", T("Fil rectiligne", "سلك مستقيم", "Straight wire")], ["solenoid", T("Solénoïde", "وشيعة", "Solenoid")], ["laplace", T("Rails de Laplace", "سكتا لابلاس", "Laplace rails")]]),
      num("I", T("Intensité I (A)", "الشدة I", "Current I (A)"), -10, 10, 0.5, 4),
      num("N", T("Nombre de spires (solénoïde)", "عدد اللفات", "Turns (solenoid)"), 50, 2000, 50, 500),
      num("B", T("Champ B (mT, rails de Laplace)", "المجال B (mT)", "Field B (mT, rails)"), 1, 100, 1, 40),
      bool("compass", T("Aiguilles aimantées", "إبر ممغنطة", "Compasses"), true),
    ],
  },
  {
    id: "incline", group: "physics", icon: "📐", level: "TC · 1re Bac · 2e Bac", animated: true,
    label: T("Solide sur un plan incliné", "جسم على مستوى مائل", "Block on an inclined plane"),
    desc: T("Forces (poids, réaction, frottement), équilibre, glissement, travail et énergie cinétique.", "القوى والتوازن والانزلاق والشغل والطاقة الحركية.", "Forces, equilibrium, sliding, work and kinetic energy."),
    params: [
      num("alpha", T("Inclinaison α (°)", "زاوية الميل α", "Slope α (°)"), 0, 60, 1, 25),
      num("m", T("Masse m (kg)", "الكتلة m", "Mass m (kg)"), 0.1, 10, 0.1, 2),
      num("mu", T("Coefficient de frottement μ", "معامل الاحتكاك μ", "Friction coefficient μ"), 0, 1, 0.01, 0.2),
      bool("forces", T("Représenter les forces", "تمثيل القوى", "Show forces"), true),
      bool("decompose", T("Décomposer le poids", "تفكيك الوزن", "Decompose the weight"), false),
    ],
  },
  {
    id: "lever", group: "physics", icon: "⚖️", level: "TC · 1re Bac", animated: true,
    label: T("Équilibre en rotation : moments", "التوازن في الدوران: العزوم", "Rotational equilibrium: moments"),
    desc: T("Barre mobile autour d'un axe : théorème des moments M = F·d, condition d'équilibre.", "قضيب قابل للدوران: مبرهنة العزوم وشرط التوازن.", "Bar rotating about an axis: moment theorem, equilibrium."),
    params: [
      num("m1", T("Masse à gauche m₁ (g)", "الكتلة m₁ (غ)", "Left mass m₁ (g)"), 0, 500, 10, 200),
      num("d1", T("Distance d₁ (cm)", "المسافة d₁", "Distance d₁ (cm)"), 2, 40, 1, 15),
      num("m2", T("Masse à droite m₂ (g)", "الكتلة m₂ (غ)", "Right mass m₂ (g)"), 0, 500, 10, 100),
      num("d2", T("Distance d₂ (cm)", "المسافة d₂", "Distance d₂ (cm)"), 2, 40, 1, 30),
    ],
  },
  {
    id: "rc", group: "physics", icon: "🔋", level: "2e Bac", animated: true,
    label: T("Dipôles RC et RL", "ثنائيا القطب RC و RL", "RC and RL circuits"),
    desc: T("Charge et décharge d'un condensateur, établissement du courant dans une bobine, constante de temps τ.", "شحن وتفريغ مكثف، إقامة التيار في وشيعة، ثابتة الزمن.", "Capacitor charge/discharge, current build-up in a coil, time constant."),
    params: [
      sel("circuit", T("Circuit", "الدارة", "Circuit"), "rc_charge", [["rc_charge", T("RC : charge", "RC: الشحن", "RC: charge")], ["rc_discharge", T("RC : décharge", "RC: التفريغ", "RC: discharge")], ["rl", T("RL : établissement du courant", "RL: إقامة التيار", "RL: current build-up")]]),
      num("E", T("Tension du générateur E (V)", "توتر المولد E", "Source voltage E (V)"), 1, 12, 0.5, 6),
      num("R", T("Résistance R (Ω)", "المقاومة R", "Resistance R (Ω)"), 10, 10000, 10, 1000),
      num("C", T("Capacité C (µF)", "السعة C", "Capacitance C (µF)"), 1, 1000, 1, 100),
      num("L", T("Inductance L (mH)", "معامل التحريض L", "Inductance L (mH)"), 10, 2000, 10, 500),
    ],
  },
  {
    id: "rlc", group: "physics", icon: "📈", level: "2e Bac", animated: true,
    label: T("Circuit RLC série : oscillations libres", "الدارة RLC: التذبذبات الحرة", "Series RLC: free oscillations"),
    desc: T("Régimes périodique, pseudo-périodique et apériodique, T₀ = 2π√(LC), échanges d'énergie.", "الأنظمة الدورية وشبه الدورية واللادورية، وتبادل الطاقة.", "Periodic, pseudo-periodic and aperiodic regimes, energy exchange."),
    params: [
      num("L", T("Inductance L (mH)", "L (mH)", "L (mH)"), 10, 1000, 10, 100),
      num("C", T("Capacité C (µF)", "C (µF)", "C (µF)"), 1, 100, 1, 10),
      num("R", T("Résistance totale R (Ω)", "المقاومة الكلية R", "Total resistance R (Ω)"), 0, 500, 1, 20),
      num("E", T("Tension initiale du condensateur (V)", "التوتر البدئي", "Initial capacitor voltage (V)"), 1, 12, 0.5, 6),
      bool("energy", T("Énergies électrique et magnétique", "الطاقة الكهربائية والمغنطيسية", "Electric and magnetic energy"), false),
    ],
  },
  {
    id: "decay", group: "physics", icon: "☢️", level: "2e Bac", animated: true,
    label: T("Décroissance radioactive", "التناقص الإشعاعي", "Radioactive decay"),
    desc: T("Désintégrations aléatoires, loi N(t) = N₀·e^(−λt), demi-vie, datation au carbone 14.", "التفتتات العشوائية وقانون التناقص وعمر النصف والتأريخ بالكربون 14.", "Random decays, decay law, half-life, carbon-14 dating."),
    params: [
      sel("nuclide", T("Noyau", "النويدة", "Nuclide"), "c14", [["c14", T("Carbone 14 (t½ = 5 730 ans)", "الكربون 14", "Carbon-14")], ["i131", T("Iode 131 (t½ = 8 jours)", "اليود 131", "Iodine-131")], ["po210", T("Polonium 210 (t½ = 138 jours)", "البولونيوم 210", "Polonium-210")], ["co60", T("Cobalt 60 (t½ = 5,27 ans)", "الكوبالت 60", "Cobalt-60")]]),
      num("N0", T("Nombre de noyaux affichés", "عدد النوى", "Number of nuclei shown"), 50, 1000, 10, 400),
      num("speed", T("Vitesse (demi-vies par 10 s)", "السرعة", "Speed (half-lives per 10 s)"), 0.5, 5, 0.5, 2),
      num("seed", T("Tirage (changer pour recommencer)", "السحب", "Draw (change to restart)"), 1, 999, 1, 1),
    ],
  },
  {
    id: "gas", group: "chemistry", icon: "💨", level: "TC · 1re Bac", animated: true,
    label: T("Gaz parfait : agitation des molécules", "الغاز الكامل: حركة الجزيئات", "Ideal gas: molecular motion"),
    desc: T("Pression, volume, température et quantité de matière : PV = nRT, loi de Boyle-Mariotte.", "الضغط والحجم ودرجة الحرارة وكمية المادة: PV = nRT.", "Pressure, volume, temperature, amount: PV = nRT, Boyle's law."),
    params: [
      num("n", T("Quantité de matière n (mmol)", "كمية المادة n (mmol)", "Amount n (mmol)"), 1, 20, 0.5, 4),
      num("T", T("Température T (K)", "درجة الحرارة T", "Temperature T (K)"), 100, 800, 5, 300),
      num("V", T("Volume V (L)", "الحجم V", "Volume V (L)"), 0.05, 0.5, 0.01, 0.1),
    ],
  },
  // ------------------------------------------------------------------ chimie
  {
    id: "molecule", group: "chemistry", icon: "⚗️", level: "TC · 1re Bac · 2e Bac", animated: false,
    label: T("Molécules en 3D", "الجزيئات ثلاثية الأبعاد", "Molecules in 3D"),
    desc: T("Géométrie des molécules (modèle de Gillespie), formules de Lewis, groupes caractéristiques en chimie organique.", "هندسة الجزيئات ونموذج جيليسبي والمجموعات المميزة.", "Molecular geometry (VSEPR), Lewis structures, functional groups."),
    params: [
      sel("mol", T("Molécule", "الجزيئة", "Molecule"), "h2o", [
        ["h2", T("Dihydrogène H₂", "ثنائي الهيدروجين", "H₂")], ["o2", T("Dioxygène O₂", "ثنائي الأكسجين", "O₂")], ["n2", T("Diazote N₂", "ثنائي الآزوت", "N₂")], ["hcl", T("Chlorure d'hydrogène HCl", "كلورور الهيدروجين", "HCl")],
        ["h2o", T("Eau H₂O", "الماء", "Water H₂O")], ["nh3", T("Ammoniac NH₃", "الأمونياك", "Ammonia NH₃")], ["ch4", T("Méthane CH₄", "الميثان", "Methane CH₄")], ["co2", T("Dioxyde de carbone CO₂", "ثنائي أكسيد الكربون", "CO₂")],
        ["h3o", T("Ion oxonium H₃O⁺", "أيون الأوكسونيوم", "Oxonium H₃O⁺")], ["nh4", T("Ion ammonium NH₄⁺", "أيون الأمونيوم", "Ammonium NH₄⁺")],
        ["c2h6", T("Éthane", "الإيثان", "Ethane")], ["c2h4", T("Éthène (éthylène)", "الإيثين", "Ethene")], ["c2h2", T("Éthyne (acétylène)", "الإيثين الثلاثي", "Ethyne")],
        ["butane", T("Butane", "البوتان", "Butane")], ["isobutane", T("Méthylpropane (isomère)", "مثيل البروبان", "Methylpropane")],
        ["methanol", T("Méthanol", "الميثانول", "Methanol")], ["ethanol", T("Éthanol (alcool)", "الإيثانول", "Ethanol")], ["ethanal", T("Éthanal (aldéhyde)", "الإيثانال", "Ethanal")],
        ["propanone", T("Propanone (cétone)", "البروبانون", "Propanone")], ["acetic", T("Acide éthanoïque", "حمض الإيثانويك", "Ethanoic acid")], ["ester", T("Éthanoate d'éthyle (ester)", "إيثانوات الإيثيل", "Ethyl ethanoate")],
        ["ethylamine", T("Éthylamine (amine)", "الإيثيل أمين", "Ethylamine")], ["benzene", T("Benzène", "البنزين", "Benzene")],
      ]),
      sel("style", T("Représentation", "التمثيل", "Style"), "ball", [["ball", T("Boules et bâtonnets", "كرات وعصي", "Ball and stick")], ["fill", T("Compacte", "متراصة", "Space-filling")]]),
      labels,
      bool("pairs", T("Doublets non liants", "الأزواج غير الرابطة", "Lone pairs"), true),
      bool("spin", T("Rotation automatique", "دوران تلقائي", "Auto-rotate"), false),
    ],
  },
  {
    id: "atom", group: "chemistry", icon: "⚛️", level: "TC", animated: true,
    label: T("Modèle de l'atome", "نموذج الذرة", "Atomic model"),
    desc: T("Noyau (protons, neutrons) et répartition des électrons sur les couches K, L, M ; tableau périodique.", "النواة والتوزيع الإلكتروني على الطبقات K و L و M.", "Nucleus and electron shells K, L, M; periodic table."),
    params: [num("Z", T("Numéro atomique Z", "العدد الذري Z", "Atomic number Z"), 1, 20, 1, 8), labels],
  },
  {
    id: "crystal", group: "chemistry", icon: "🧂", level: "TC · 1re Bac", animated: false,
    label: T("Cristaux ioniques et métalliques", "البلورات الأيونية والفلزية", "Ionic and metallic crystals"),
    desc: T("Chlorure de sodium, chlorure de césium, maille cubique à faces centrées (cuivre).", "كلورور الصوديوم وكلورور السيزيوم والشبكة المكعبة.", "Sodium chloride, caesium chloride, face-centred cubic."),
    params: [
      sel("type", T("Cristal", "البلورة", "Crystal"), "nacl", [["nacl", T("NaCl (sel)", "NaCl", "NaCl")], ["cscl", T("CsCl", "CsCl", "CsCl")], ["fcc", T("Cuivre (cubique faces centrées)", "النحاس", "Copper (FCC)")]]),
      num("cells", T("Nombre de mailles par arête", "عدد الخلايا", "Cells per edge"), 1, 3, 1, 2),
      bool("compact", T("Ions en contact (compact)", "متراص", "Compact"), false),
    ],
  },
  {
    id: "titration", group: "chemistry", icon: "🧪", level: "1re Bac · 2e Bac", animated: true,
    label: T("Dosage acido-basique (pH-métrie)", "المعايرة حمض-قاعدة", "Acid-base titration"),
    desc: T("Courbe pH = f(V_B), point d'équivalence, méthode des tangentes, choix de l'indicateur coloré.", "منحنى pH وحجم التكافؤ واختيار الكاشف الملون.", "pH curve, equivalence point, choosing an indicator."),
    params: [
      sel("acid", T("Acide dosé", "الحمض المعاير", "Acid titrated"), "weak", [["strong", T("Acide fort (HCl)", "حمض قوي", "Strong acid (HCl)")], ["weak", T("Acide faible (CH₃COOH)", "حمض ضعيف", "Weak acid (CH₃COOH)")]]),
      num("Ca", T("Concentration de l'acide Cₐ (mol/L)", "تركيز الحمض", "Acid concentration (mol/L)"), 0.001, 0.2, 0.001, 0.05),
      num("Va", T("Volume d'acide Vₐ (mL)", "حجم الحمض", "Acid volume (mL)"), 5, 50, 1, 20),
      num("Cb", T("Concentration de la soude C_B (mol/L)", "تركيز الصودا", "NaOH concentration (mol/L)"), 0.01, 0.2, 0.005, 0.1),
      num("pKa", T("pKa (acide faible)", "pKa", "pKa (weak acid)"), 2, 10, 0.1, 4.8),
      sel("indicator", T("Indicateur coloré", "الكاشف الملون", "Indicator"), "phenol", [["phenol", T("Phénolphtaléine (8,2 – 10)", "الفينول فتالين", "Phenolphthalein")], ["bbt", T("Bleu de bromothymol (6 – 7,6)", "أزرق البروموتيمول", "Bromothymol blue")], ["helianthine", T("Hélianthine (3,1 – 4,4)", "الهيليانتين", "Methyl orange")]]),
    ],
  },
  {
    id: "kinetics", group: "chemistry", icon: "⏱️", level: "2e Bac", animated: true,
    label: T("Suivi temporel d'une transformation", "التتبع الزمني لتحول", "Reaction kinetics"),
    desc: T("Avancement x(t), vitesse volumique, temps de demi-réaction ; effet de la température et de la concentration.", "التقدم والسرعة الحجمية وزمن نصف التفاعل وتأثير درجة الحرارة.", "Extent x(t), rate, half-reaction time; effect of temperature."),
    params: [
      num("C0", T("Concentration initiale (mmol/L)", "التركيز البدئي", "Initial concentration (mmol/L)"), 1, 100, 1, 20),
      num("T", T("Température (°C)", "درجة الحرارة", "Temperature (°C)"), 0, 80, 1, 25),
      num("k25", T("Constante de vitesse à 25 °C (min⁻¹)", "ثابتة السرعة", "Rate constant at 25 °C (1/min)"), 0.01, 1, 0.01, 0.1),
      bool("tangent", T("Tangente (vitesse) au curseur", "المماس", "Tangent at cursor"), true),
    ],
  },
  {
    id: "electrochem", group: "chemistry", icon: "🔌", level: "2e Bac", animated: true,
    label: T("Pile Daniell et électrolyse", "عمود دانيال والتحليل الكهربائي", "Daniell cell and electrolysis"),
    desc: T("Transformations spontanées (pile) et forcées (électrolyse) : électrodes, pont salin, sens des électrons et des ions.", "التحولات التلقائية والقسرية: الإلكترودات والقنطرة الملحية وحركة الإلكترونات.", "Spontaneous and forced transformations: electrodes, salt bridge, electron flow."),
    params: [
      sel("mode", T("Montage", "التركيب", "Setup"), "pile", [["pile", T("Pile Daniell (Zn / Cu)", "عمود دانيال", "Daniell cell")], ["electrolyse", T("Électrolyse (CuCl₂)", "التحليل الكهربائي", "Electrolysis (CuCl₂)")]]),
      num("I", T("Intensité du courant (mA)", "شدة التيار", "Current (mA)"), 10, 500, 10, 100),
      num("t", T("Durée de fonctionnement (min)", "مدة الاشتغال", "Duration (min)"), 1, 120, 1, 30),
      labels,
    ],
  },
  // ------------------------------------------------------------------ SVT
  {
    id: "cell", group: "svt", icon: "🦠", level: "TC · 1re Bac", animated: true,
    label: T("La cellule", "الخلية", "The cell"),
    desc: T("Cellule animale ou végétale en coupe : membrane, noyau, mitochondries, chloroplastes, vacuole, paroi.", "خلية حيوانية أو نباتية: الغشاء والنواة والميتوكوندريات والصانعات.", "Animal or plant cell: membrane, nucleus, mitochondria, chloroplasts."),
    params: [
      sel("type", T("Cellule", "الخلية", "Cell"), "plant", [["animal", T("Animale", "حيوانية", "Animal")], ["plant", T("Végétale", "نباتية", "Plant")]]),
      bool("cut", T("Vue en coupe", "مقطع", "Cutaway"), true), labels,
    ],
  },
  {
    id: "organelle", group: "svt", icon: "🔬", level: "1re Bac · 2e Bac", animated: true,
    label: T("Chloroplaste, mitochondrie, sarcomère", "الصانعة الخضراء والميتوكوندري والقسيم العضلي", "Chloroplast, mitochondrion, sarcomere"),
    desc: T("Ultrastructure des organites de la photosynthèse et de la respiration, et contraction musculaire (glissement des filaments).", "بنية عضيات التركيب الضوئي والتنفس والتقلص العضلي.", "Organelles of photosynthesis and respiration; muscle contraction."),
    params: [
      sel("mode", T("Structure", "البنية", "Structure"), "chloroplast", [["chloroplast", T("Chloroplaste", "الصانعة الخضراء", "Chloroplast")], ["mitochondria", T("Mitochondrie", "الميتوكوندري", "Mitochondrion")], ["sarcomere", T("Sarcomère (myofibrille)", "القسيم العضلي", "Sarcomere")]]),
      num("contraction", T("Contraction du sarcomère", "تقلص القسيم العضلي", "Sarcomere contraction"), 0, 1, 0.01, 0),
      labels,
    ],
  },
  {
    id: "dna", group: "svt", icon: "🧬", level: "2e Bac", animated: true,
    label: T("ADN : structure, réplication, transcription", "ADN: البنية والتضاعف والاستنساخ", "DNA: structure, replication, transcription"),
    desc: T("Double hélice, complémentarité des bases (A–T, G–C), réplication semi-conservative, ARNm et code génétique.", "اللولب المزدوج وتكامل القواعد والتضاعف والاستنساخ.", "Double helix, base pairing, replication, mRNA and genetic code."),
    params: [
      { key: "seq", type: "text", label: T("Séquence du brin transcrit (A, T, G, C)", "متتالية اللولب", "Sequence (A, T, G, C)"), def: "TACGGATTCACT", placeholder: "TACGGA…", student: true },
      sel("mode", T("Phénomène", "الظاهرة", "Process"), "helix", [["helix", T("Double hélice", "اللولب المزدوج", "Double helix")], ["replication", T("Réplication", "التضاعف", "Replication")], ["transcription", T("Transcription + traduction", "الاستنساخ والترجمة", "Transcription + translation")]]),
      num("open", T("Ouverture de la molécule", "انفتاح الجزيئة", "Opening"), 0, 1, 0.01, 0.6),
      labels,
    ],
  },
  {
    id: "division", group: "svt", icon: "🧫", level: "2e Bac", animated: false,
    label: T("Mitose et méiose", "الانقسام غير المباشر والاختزالي", "Mitosis and meiosis"),
    desc: T("Comportement des chromosomes à chaque phase, réduction chromatique et brassage.", "سلوك الصبغيات في كل مرحلة، الاختزال الصبغي والتخليط.", "Chromosome behaviour at each phase, reduction and shuffling."),
    params: [
      sel("type", T("Division", "الانقسام", "Division"), "mitosis", [["mitosis", T("Mitose", "الانقسام غير المباشر", "Mitosis")], ["meiosis", T("Méiose", "الانقسام الاختزالي", "Meiosis")]]),
      num("phase", T("Phase", "المرحلة", "Phase"), 0, 1, 0.01, 0.35),
      num("pairs", T("Paires de chromosomes (n)", "أزواج الصبغيات (n)", "Chromosome pairs (n)"), 1, 4, 1, 2),
      bool("crossing", T("Crossing-over (méiose)", "العبور", "Crossing-over"), true),
    ],
  },
  {
    id: "punnett", group: "svt", icon: "🫛", level: "2e Bac", animated: false,
    label: T("Lois de Mendel : échiquier de croisement", "قوانين ماندل: شبكة التزاوج", "Mendel's laws: Punnett square"),
    desc: T("Monohybridisme et dihybridisme, dominance, croisement-test : phénotypes et proportions.", "الهجونة الأحادية والثنائية والسيادة والتزاوج الاختباري.", "Monohybrid and dihybrid crosses, dominance, test cross."),
    params: [
      sel("cross", T("Croisement", "التزاوج", "Cross"), "di", [["mono", T("Monohybridisme F1 × F1", "هجونة أحادية", "Monohybrid F1 × F1")], ["mono_test", T("Monohybridisme : croisement-test", "تزاوج اختباري أحادي", "Monohybrid test cross")], ["di", T("Dihybridisme F1 × F1 (9:3:3:1)", "هجونة ثنائية", "Dihybrid F1 × F1")], ["di_test", T("Dihybridisme : croisement-test", "تزاوج اختباري ثنائي", "Dihybrid test cross")]]),
      sel("dominance", T("Relation entre allèles", "العلاقة بين الحليلات", "Allele relation"), "complete", [["complete", T("Dominance complète", "سيادة تامة", "Complete dominance")], ["co", T("Codominance", "تساوي السيادة", "Codominance")]]),
    ],
  },
  {
    id: "neuron", group: "svt", icon: "⚡", level: "1re Bac", animated: true,
    label: T("Neurone et message nerveux", "العصبون والسيالة العصبية", "Neuron and nerve impulse"),
    desc: T("Structure du neurone, propagation du potentiel d'action (continue ou saltatoire), vitesse de conduction.", "بنية العصبون وانتشار جهد العمل وسرعة التوصيل.", "Neuron structure, action potential propagation, conduction speed."),
    params: [
      bool("myelin", T("Fibre myélinisée (saltatoire)", "ليف نخاعيني", "Myelinated fibre"), true),
      num("speed", T("Vitesse de conduction (m/s)", "سرعة التوصيل", "Conduction speed (m/s)"), 0.5, 100, 0.5, 50),
      num("freq", T("Fréquence des potentiels d'action (Hz)", "تردد جهود العمل", "AP frequency (Hz)"), 0.2, 3, 0.1, 0.8),
      labels,
    ],
  },
  {
    id: "geology", group: "svt", icon: "🌋", level: "1re Bac · 2e Bac", animated: false,
    label: T("Géologie : structures et tectonique", "الجيولوجيا: البنيات والتكتونية", "Geology: structures and tectonics"),
    desc: T("Structure interne du globe, subduction, collision, plis, failles, série sédimentaire et principes de stratigraphie.", "البنية الداخلية للأرض والطمر والاصطدام والطيات والفوالق.", "Earth's interior, subduction, collision, folds, faults, sedimentary series."),
    params: [
      sel("mode", T("Structure", "البنية", "Structure"), "subduction", [["globe", T("Structure interne du globe", "البنية الداخلية للأرض", "Earth's interior")], ["subduction", T("Subduction", "الطمر", "Subduction")], ["collision", T("Collision (chaîne de montagnes)", "الاصطدام", "Collision")], ["fold", T("Pli (anticlinal / synclinal)", "الطية", "Fold")], ["fault", T("Faille", "الفالق", "Fault")], ["strata", T("Série sédimentaire et érosion", "سلسلة رسوبية وتعرية", "Sedimentary series and erosion")]]),
      num("amount", T("Intensité (déformation, rejet, érosion)", "الشدة", "Intensity"), 0, 1, 0.01, 0.5),
      sel("fault", T("Type de faille", "نوع الفالق", "Fault type"), "normal", [["normal", T("Normale (extension)", "عادي", "Normal")], ["reverse", T("Inverse (compression)", "معكوس", "Reverse")]]),
      labels,
    ],
  },
  {
    id: "ecopyramid", group: "svt", icon: "🌿", level: "TC", animated: false,
    label: T("Pyramide écologique et flux d'énergie", "الهرم البيئي وتدفق الطاقة", "Ecological pyramid and energy flow"),
    desc: T("Niveaux trophiques, rendement écologique, pertes par respiration ; pyramide des énergies, des biomasses ou des nombres.", "المستويات الغذائية والمردود البيئي والضياع بالتنفس.", "Trophic levels, ecological efficiency, energy losses."),
    params: [
      num("P", T("Production primaire (kJ/m²/an)", "الإنتاج الأولي", "Primary production (kJ/m²/yr)"), 1000, 50000, 500, 20000),
      num("eff", T("Rendement d'un niveau à l'autre (%)", "المردود (%)", "Transfer efficiency (%)"), 2, 25, 0.5, 10),
      num("levels", T("Nombre de niveaux trophiques", "عدد المستويات", "Trophic levels"), 2, 5, 1, 4),
      sel("scale", T("Échelle", "السلم", "Scale"), "log", [["log", T("Logarithmique", "لوغاريتمي", "Logarithmic")], ["lin", T("Linéaire", "خطي", "Linear")]]),
    ],
  },
  {
    id: "flower", group: "svt", icon: "🌸", level: "TC", animated: false,
    label: T("La fleur : organes reproducteurs", "الزهرة: أعضاء التوالد", "The flower: reproductive organs"),
    desc: T("Sépales, pétales, étamines (anthère, filet) et pistil (stigmate, style, ovaire) ; dissection progressive.", "السبلات والبتلات والأسدية والمدقة؛ تشريح تدريجي.", "Sepals, petals, stamens and pistil; progressive dissection."),
    params: [
      num("open", T("Dissection (écarter les pièces)", "التشريح", "Dissection"), 0, 1, 0.01, 0),
      num("petals", T("Nombre de pétales", "عدد البتلات", "Petals"), 3, 8, 1, 5),
      bool("cut", T("Coupe de l'ovaire", "مقطع المبيض", "Ovary section"), false), labels,
    ],
  },
];
