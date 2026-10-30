/**
 * Bibliothèque de labos du Labo 3D, organisée selon le programme marocain du lycée
 * (tronc commun, 1re et 2e année du baccalauréat, filières scientifiques).
 * Chaque labo = un modèle + des réglages de départ + un objectif + des consignes.
 */
import type { Params, Tri } from "./templates";

export type Subject = "math" | "physics" | "chemistry" | "svt";
export type Level = "TC" | "1BAC" | "2BAC";
export interface LabEntry { id: string; title: Tri; template: string; params?: Params; goal: Tri; steps: Tri[] }
export interface LabLesson { id: string; subject: Subject; level: Level; part: Tri; title: Tri; labs: LabEntry[] }

/** français + arabe (l'anglais reprend le français) */
const F = (fr: string, ar: string): Tri => ({ fr, ar, en: fr });
const lab = (id: string, title: Tri, template: string, params: Params, goal: Tri, ...steps: Tri[]): LabEntry => ({ id, title, template, params, goal, steps });

export const SUBJECTS: { id: Subject; icon: string; label: Tri }[] = [
  { id: "math", icon: "📐", label: F("Mathématiques", "الرياضيات") },
  { id: "physics", icon: "⚛️", label: F("Physique", "الفيزياء") },
  { id: "chemistry", icon: "⚗️", label: F("Chimie", "الكيمياء") },
  { id: "svt", icon: "🧬", label: F("SVT", "علوم الحياة والأرض") },
];
export const LEVELS: { id: Level; label: Tri }[] = [
  { id: "TC", label: F("Tronc commun", "الجذع المشترك") },
  { id: "1BAC", label: F("1re année Bac", "الأولى باكالوريا") },
  { id: "2BAC", label: F("2e année Bac", "الثانية باكالوريا") },
];

export const LESSONS: LabLesson[] = [
  // ================================================================ MATHÉMATIQUES
  {
    id: "m-tc-espace", subject: "math", level: "TC", part: F("Géométrie", "الهندسة"), title: F("Géométrie dans l'espace", "الهندسة الفضائية"),
    labs: [
      lab("m-tc-cube-sections", F("Sections planes d'un cube", "المقاطع المستوية لمكعب"), "cube", { section: "triangle" },
        F("Identifier la nature de la section d'un cube par un plan.", "التعرف على طبيعة مقطع مكعب بمستوى."),
        F("Choisissez la section (BDE) : quelle est la nature du triangle obtenu ? Justifiez avec les diagonales des faces.", "اختر المقطع (BDE): ما طبيعة المثلث المحصل؟ علل باستعمال أقطار الأوجه."),
        F("Passez à la section (ABGH) : montrez que c'est un rectangle et calculez ses dimensions pour a = 4.", "انتقل إلى المقطع (ABGH): بين أنه مستطيل واحسب بعديه من أجل a = 4."),
        F("Observez la section hexagonale : combien de faces du cube le plan coupe-t-il ?", "لاحظ المقطع السداسي: كم وجها يقطع المستوى؟")),
      lab("m-tc-cube-diag", F("Diagonale d'un cube", "قطر المكعب"), "cube", { diagonals: true },
        F("Calculer la longueur de la grande diagonale avec Pythagore.", "حساب طول القطر الرئيسي بمبرهنة فيثاغورس."),
        F("Calculez AC dans le triangle rectangle ABC, puis AG dans le triangle ACG.", "احسب AC في المثلث القائم ABC ثم AG في المثلث ACG."),
        F("Vérifiez que AG = a√3 en changeant la valeur de a.", "تحقق أن AG = a√3 بتغيير قيمة a.")),
      lab("m-tc-pyramide", F("Pyramide : hauteur, apothème et volume", "الهرم: الارتفاع والعامد والحجم"), "pyramid", { height: true },
        F("Utiliser Pythagore dans l'espace et calculer un volume.", "استعمال فيثاغورس في الفضاء وحساب الحجم."),
        F("Exprimez SI en fonction de h et a, puis SA.", "عبر عن SI بدلالة h و a ثم عن SA."),
        F("Calculez le volume pour a = 4 et h = 5, puis comparez avec l'affichage.", "احسب الحجم من أجل a = 4 و h = 5 وقارن مع النتيجة المعروضة.")),
      lab("m-tc-pyramide-reduction", F("Section d'une pyramide et réduction", "مقطع هرم والتصغير"), "pyramid", { sectionH: 2 },
        F("Comprendre l'effet d'une réduction de rapport k sur les longueurs, les aires et les volumes.", "فهم تأثير تصغير نسبته k على الأطوال والمساحات والأحجام."),
        F("Déplacez la section : que remarquez-vous sur sa forme ?", "حرك المقطع: ماذا تلاحظ حول شكله؟"),
        F("Montrez que le rapport de réduction est k = (h − z)/h et vérifiez que le petit volume vaut k³ × V.", "بين أن نسبة التصغير هي k = (h − z)/h وتحقق أن الحجم الصغير يساوي k³ × V.")),
      lab("m-tc-patron", F("Patron du pavé droit", "نشر متوازي المستطيلات"), "cuboid", { net: true, fold: 0.5 },
        F("Relier un solide et son patron ; calculer l'aire totale.", "الربط بين المجسم ونشره وحساب المساحة الكلية."),
        F("Faites glisser le pliage de 0 à 1 : quelles faces sont identiques ?", "غير الطي من 0 إلى 1: ما الأوجه المتطابقة؟"),
        F("Calculez l'aire du patron et comparez à 2(Ll + Lh + lh).", "احسب مساحة النشر وقارنها مع 2(Ll + Lh + lh).")),
      lab("m-tc-revolution", F("Cylindre et cône : volumes", "الأسطوانة والمخروط: الأحجام"), "cone", { axis: true, sectionH: 2 },
        F("Comparer les volumes du cône et du cylindre de même base et même hauteur.", "مقارنة حجم المخروط والأسطوانة لهما نفس القاعدة والارتفاع."),
        F("Notez le volume du cône, puis ouvrez le modèle « Cylindre » avec les mêmes r et h.", "سجل حجم المخروط ثم افتح نموذج الأسطوانة بنفس r و h."),
        F("Quel est le rapport entre les deux volumes ?", "ما النسبة بين الحجمين؟")),
    ],
  },
  {
    id: "m-tc-stats", subject: "math", level: "TC", part: F("Statistiques", "الإحصاء"), title: F("Statistiques : fréquences", "الإحصاء: الترددات"),
    labs: [
      lab("m-tc-de-frequences", F("Fréquences et lancers de dé", "الترددات ورمي النرد"), "dice", { dice: "1", n: 60 },
        F("Observer la stabilisation des fréquences quand l'effectif augmente.", "ملاحظة استقرار الترددات عندما يكبر الحصيص."),
        F("Avec 60 lancers, notez la plus grande et la plus petite fréquence.", "مع 60 رمية، سجل أكبر وأصغر تردد."),
        F("Passez à 600 puis 6 000 lancers : que devient l'écart entre les fréquences ?", "انتقل إلى 600 ثم 6000 رمية: ماذا يصبح الفرق بين الترددات؟")),
    ],
  },
  {
    id: "m-1b-vecteurs", subject: "math", level: "1BAC", part: F("Géométrie", "الهندسة"), title: F("Calcul vectoriel dans l'espace", "الحساب المتجهي في الفضاء"),
    labs: [
      lab("m-1b-colineaires", F("Vecteurs colinéaires et points alignés", "متجهات مستقيمية ونقط مستقيمية"), "space", { points: "A(1, 0, 0)\nB(3, 2, 2)\nC(4, 3, 3)", vectors: "AB\nAC", lines: "AB", plane: "", triangle: false },
        F("Reconnaître des vecteurs colinéaires dans l'espace.", "التعرف على متجهات مستقيمية في الفضاء."),
        F("Lisez les coordonnées de AB et AC : sont-ils proportionnels ?", "اقرأ إحداثيات AB و AC: هل هي متناسبة؟"),
        F("Modifiez C pour que A, B et C soient alignés, puis non alignés.", "غير C لتكون A و B و C مستقيمية ثم غير مستقيمية.")),
      lab("m-1b-coplanaires", F("Points coplanaires", "نقط مستوائية"), "space", { points: "A(0, 0, 1)\nB(2, 0, 1)\nC(0, 2, 1)\nD(1, 1, 3)", vectors: "AB\nAC\nAD", plane: "0, 0, 1, -1", project: "D" },
        F("Déterminer si quatre points sont dans un même plan.", "تحديد هل أربع نقط تنتمي إلى نفس المستوى."),
        F("Le plan affiché est z = 1 : quels points lui appartiennent ?", "المستوى المعروض هو z = 1: ما النقط التي تنتمي إليه؟"),
        F("Changez D pour le placer dans le plan (ABC). Que vaut alors la distance de D au plan ?", "غير D لتضعها في المستوى (ABC). ما قيمة مسافة D عن المستوى؟")),
    ],
  },
  {
    id: "m-2b-espace", subject: "math", level: "2BAC", part: F("Géométrie", "الهندسة"), title: F("Produit scalaire, produit vectoriel et sphère", "الجداء السلمي والمتجهي والفلكة"),
    labs: [
      lab("m-2b-plan-distance", F("Équation d'un plan et distance d'un point", "معادلة مستوى ومسافة نقطة"), "space", { points: "A(1, 0, 0)\nB(0, 1, 0)\nC(0, 0, 1)\nM(2, 2, 3)", vectors: "", plane: "1, 1, 1, -1", project: "M", triangle: true },
        F("Utiliser un vecteur normal pour écrire l'équation d'un plan et calculer d(M, P).", "استعمال متجهة منظمية لكتابة معادلة مستوى وحساب المسافة."),
        F("Vérifiez que A, B et C vérifient l'équation x + y + z − 1 = 0.", "تحقق أن A و B و C تحقق المعادلة x + y + z − 1 = 0."),
        F("Calculez à la main la distance de M au plan, puis comparez.", "احسب يدويا مسافة M عن المستوى ثم قارن."),
        F("Déterminez les coordonnées du projeté orthogonal H de M.", "حدد إحداثيات المسقط العمودي H للنقطة M.")),
      lab("m-2b-vectoriel", F("Produit vectoriel et aire d'un triangle", "الجداء المتجهي ومساحة مثلث"), "space", { points: "A(2, 0, 1)\nB(0, 3, 1)\nC(1, 1, 4)", vectors: "AB\nAC", plane: "", triangle: true },
        F("Calculer AB ∧ AC, en déduire un vecteur normal et l'aire de ABC.", "حساب AB ∧ AC واستنتاج متجهة منظمية ومساحة ABC."),
        F("Calculez AB ∧ AC et comparez avec le vecteur affiché.", "احسب AB ∧ AC وقارن مع المتجهة المعروضة."),
        F("Déduisez-en une équation du plan (ABC).", "استنتج معادلة للمستوى (ABC).")),
      lab("m-2b-sphere-plan", F("Intersection d'une sphère et d'un plan", "تقاطع فلكة ومستوى"), "sphere", { r: 4, d: 2 },
        F("Déterminer le rayon du cercle d'intersection : r' = √(R² − d²).", "تحديد شعاع دائرة التقاطع."),
        F("Faites varier d : que se passe-t-il quand d = R ? quand d > R ?", "غير d: ماذا يحدث عندما d = R؟ وعندما d > R؟"),
        F("Calculez le rayon de la section pour R = 4 et d = 2.", "احسب شعاع المقطع من أجل R = 4 و d = 2.")),
    ],
  },
  {
    id: "m-2b-proba", subject: "math", level: "2BAC", part: F("Probabilités", "الاحتمالات"), title: F("Probabilités", "الاحتمالات"),
    labs: [
      lab("m-2b-deux-des", F("Somme de deux dés", "مجموع نردين"), "dice", { dice: "2", n: 3000 },
        F("Comparer fréquences observées et probabilités ; espérance.", "مقارنة الترددات الملاحظة بالاحتمالات والأمل الرياضي."),
        F("Calculez p(S = 7) et p(S = 2) à l'aide d'un tableau à double entrée.", "احسب p(S = 7) و p(S = 2) باستعمال جدول مزدوج المدخل."),
        F("Augmentez le nombre de lancers : la moyenne se rapproche-t-elle de 7 ?", "زد عدد الرميات: هل يقترب المعدل من 7؟")),
    ],
  },
  {
    id: "m-2b-fonctions", subject: "math", level: "2BAC", part: F("Analyse", "التحليل"), title: F("Fonctions : découverte en 3D", "الدوال: اكتشاف ثلاثي الأبعاد"),
    labs: [
      lab("m-2b-surface-selle", F("Surface en selle de cheval", "سطح على شكل سرج"), "surface", { f: "(x^2 - y^2)/a", a: 3 },
        F("Lire des coupes d'une surface : x fixé ou y fixé donne une parabole.", "قراءة مقاطع سطح: تثبيت x أو y يعطي شلجما."),
        F("Pour y = 0, quelle fonction de x obtient-on ? Et pour x = 0 ?", "من أجل y = 0 ما الدالة المحصلة؟ ومن أجل x = 0؟"),
        F("Que change le paramètre a ?", "ماذا يغير الوسيط a؟")),
    ],
  },

  // ================================================================ PHYSIQUE
  {
    id: "p-tc-gravitation", subject: "physics", level: "TC", part: F("Mécanique", "الميكانيك"), title: F("Gravitation universelle", "التجاذب الكوني"),
    labs: [
      lab("p-tc-satellite", F("Un satellite autour de la Terre", "قمر اصطناعي حول الأرض"), "orbit", { body: "earth", h: 800, vectors: true },
        F("Visualiser la force d'attraction gravitationnelle, toujours dirigée vers le centre de la Terre.", "تصور قوة التجاذب الكوني الموجهة نحو مركز الأرض."),
        F("Observez le sens de la force (rouge) à chaque instant.", "لاحظ منحى القوة (الأحمر) في كل لحظة."),
        F("Calculez F = G·m·M / (R + h)² pour un satellite de 1 000 kg à h = 800 km.", "احسب F = G·m·M / (R + h)² لقمر كتلته 1000 kg على ارتفاع 800 km."),
        F("Augmentez h : comment évolue l'intensité de la force ?", "زد h: كيف تتغير شدة القوة؟")),
    ],
  },
  {
    id: "p-tc-equilibre", subject: "physics", level: "TC", part: F("Mécanique", "الميكانيك"), title: F("Équilibre d'un solide soumis à des forces", "توازن جسم صلب خاضع لقوى"),
    labs: [
      lab("p-tc-incline-eq", F("Solide en équilibre sur un plan incliné", "جسم في توازن على مستوى مائل"), "incline", { alpha: 20, mu: 0.5, forces: true },
        F("Appliquer la condition d'équilibre : P + R = 0 ; frottement et réaction.", "تطبيق شرط التوازن P + R = 0 والاحتكاك."),
        F("Repérez les forces P, R_N et f. Que vaut leur somme vectorielle ?", "حدد القوى P و R_N و f. ما مجموعها المتجهي؟"),
        F("Augmentez α jusqu'au glissement : relevez l'angle limite et comparez tan α à μ.", "زد α حتى الانزلاق: سجل الزاوية الحدية وقارن tan α مع μ.")),
      lab("p-tc-moments", F("Équilibre d'une barre : théorème des moments", "توازن قضيب: مبرهنة العزوم"), "lever", { m1: 200, d1: 15, m2: 100, d2: 30 },
        F("Vérifier la condition d'équilibre d'un solide mobile autour d'un axe fixe : ΣM = 0.", "التحقق من شرط توازن جسم قابل للدوران حول محور ثابت."),
        F("Calculez M₁ et M₂ : la barre est-elle en équilibre ?", "احسب M₁ و M₂: هل القضيب في توازن؟"),
        F("Doublez m₂ : où placer la masse pour retrouver l'équilibre ?", "ضاعف m₂: أين يجب وضعها لاستعادة التوازن؟")),
    ],
  },
  {
    id: "p-1b-travail", subject: "physics", level: "1BAC", part: F("Mécanique", "الميكانيك"), title: F("Travail et énergie cinétique", "الشغل والطاقة الحركية"),
    labs: [
      lab("p-1b-incline-ec", F("Théorème de l'énergie cinétique sur un plan incliné", "مبرهنة الطاقة الحركية على مستوى مائل"), "incline", { alpha: 30, mu: 0.1, forces: true, decompose: true },
        F("Relier la variation d'énergie cinétique à la somme des travaux des forces.", "ربط تغير الطاقة الحركية بمجموع أشغال القوى."),
        F("Exprimez le travail du poids W(P) = m·g·d·sin α et celui du frottement W(f) = −f·d.", "عبر عن شغل الوزن وشغل قوة الاحتكاك."),
        F("Vérifiez que ΔEc = W(P) + W(f) avec les valeurs affichées.", "تحقق أن ΔEc = W(P) + W(f) بالقيم المعروضة."),
        F("Mettez μ = 0 : comment évolue la vitesse en bas ?", "ضع μ = 0: كيف تتغير السرعة في الأسفل؟")),
    ],
  },
  {
    id: "p-1b-energie", subject: "physics", level: "1BAC", part: F("Mécanique", "الميكانيك"), title: F("Énergie potentielle de pesanteur et énergie mécanique", "طاقة الوضع الثقالية والطاقة الميكانيكية"),
    labs: [
      lab("p-1b-pendule-energie", F("Conservation de l'énergie mécanique d'un pendule", "انحفاظ الطاقة الميكانيكية لنواس"), "pendulum", { theta: 40, energy: true, damping: 0 },
        F("Observer les échanges entre énergie cinétique et énergie potentielle.", "ملاحظة التحولات بين الطاقة الحركية وطاقة الوضع."),
        F("Où l'énergie cinétique est-elle maximale ? Et l'énergie potentielle ?", "أين تكون الطاقة الحركية قصوى؟ وطاقة الوضع؟"),
        F("Ajoutez des frottements : que devient l'énergie mécanique ?", "أضف احتكاكات: ماذا تصبح الطاقة الميكانيكية؟")),
    ],
  },
  {
    id: "p-1b-magnetisme", subject: "physics", level: "1BAC", part: F("Électricité", "الكهرباء"), title: F("Champ magnétique et forces électromagnétiques", "المجال المغنطيسي والقوى الكهرمغنطيسية"),
    labs: [
      lab("p-1b-aimant", F("Lignes de champ d'un aimant droit", "خطوط مجال مغنطيس مستقيم"), "magnet", { source: "magnet", compass: true },
        F("Décrire le champ magnétique d'un aimant et l'orientation d'une aiguille aimantée.", "وصف المجال المغنطيسي لمغنطيس وتوجيه إبرة ممغنطة."),
        F("D'où sortent les lignes de champ ? Où entrent-elles ?", "من أين تخرج خطوط المجال؟ وأين تدخل؟"),
        F("Comment s'oriente chaque aiguille par rapport aux lignes ?", "كيف تتوجه كل إبرة بالنسبة للخطوط؟")),
      lab("p-1b-solenoide", F("Champ créé par un solénoïde", "المجال المحدث من طرف وشيعة"), "magnet", { source: "solenoid", I: 2, N: 500 },
        F("Montrer que le champ est uniforme à l'intérieur d'un solénoïde : B = μ₀·N·I/L.", "بيان أن المجال منتظم داخل الوشيعة."),
        F("Repérez les faces nord et sud ; inversez le courant.", "حدد الوجهين الشمالي والجنوبي واعكس التيار."),
        F("Doublez I puis N : comment varie B ?", "ضاعف I ثم N: كيف يتغير B؟")),
      lab("p-1b-fil", F("Champ créé par un fil rectiligne", "المجال المحدث من طرف سلك مستقيم"), "magnet", { source: "wire", I: 5 },
        F("Lignes de champ circulaires autour d'un fil parcouru par un courant.", "خطوط مجال دائرية حول سلك يمر فيه تيار."),
        F("Appliquez la règle de la main droite pour retrouver le sens des lignes.", "طبق قاعدة اليد اليمنى لإيجاد منحى الخطوط."),
        F("Inversez I : que deviennent les aiguilles ?", "اعكس I: ماذا يحدث للإبر؟")),
      lab("p-1b-laplace", F("Rails de Laplace", "سكتا لابلاس"), "magnet", { source: "laplace", I: 4, B: 40 },
        F("Caractériser la force de Laplace F = I·ℓ·B et son sens.", "تحديد مميزات قوة لابلاس ومنحاها."),
        F("Utilisez la règle des trois doigts pour prévoir le sens du mouvement.", "استعمل قاعدة الأصابع الثلاثة لتوقع منحى الحركة."),
        F("Inversez le courant puis augmentez B : qu'observez-vous ?", "اعكس التيار ثم زد B: ماذا تلاحظ؟")),
    ],
  },
  {
    id: "p-1b-optique", subject: "physics", level: "1BAC", part: F("Optique", "البصريات"), title: F("Images données par une lentille mince", "الصور المحصلة بعدسة رقيقة"),
    labs: [
      lab("p-1b-lentille-reelle", F("Image réelle d'un objet", "الصورة الحقيقية لشيء"), "lens", { type: "conv", f: 10, OA: -30 },
        F("Construire l'image avec les rayons particuliers et vérifier la relation de conjugaison.", "إنشاء الصورة بالأشعة الخاصة والتحقق من علاقة المرافقة."),
        F("Calculez OA' avec 1/OA' − 1/OA = 1/f' puis comparez.", "احسب OA' بعلاقة المرافقة وقارن."),
        F("Calculez le grandissement γ : l'image est-elle droite ou renversée ?", "احسب التكبير γ: هل الصورة مستقيمة أم مقلوبة؟"),
        F("Approchez l'objet du foyer : que devient l'image ?", "قرب الشيء من البؤرة: ماذا يحدث للصورة؟")),
      lab("p-1b-loupe", F("La loupe", "المكبرة"), "lens", { type: "conv", f: 10, OA: -6 },
        F("Comprendre pourquoi une lentille convergente donne une image virtuelle agrandie.", "فهم لماذا تعطي العدسة المجمعة صورة افتراضية مكبرة."),
        F("Où est placé l'objet par rapport au foyer F ?", "أين يوجد الشيء بالنسبة للبؤرة F؟"),
        F("L'image peut-elle être recueillie sur un écran ? Pourquoi ?", "هل يمكن التقاط الصورة على شاشة؟ لماذا؟")),
      lab("p-1b-divergente", F("Lentille divergente", "عدسة مفرقة"), "lens", { type: "div", f: 12, OA: -25 },
        F("Caractériser l'image donnée par une lentille divergente.", "تحديد مميزات الصورة المحصلة بعدسة مفرقة."),
        F("Quelle est la nature de l'image, quelle que soit la position de l'objet ?", "ما طبيعة الصورة مهما كان موضع الشيء؟"),
        F("Que vaut la vergence C ? Quel est son signe ?", "ما قيمة التقارب C؟ وما إشارته؟")),
    ],
  },
  {
    id: "p-2b-ondes", subject: "physics", level: "2BAC", part: F("Ondes", "الموجات"), title: F("Ondes mécaniques progressives", "الموجات الميكانيكية المتوالية"),
    labs: [
      lab("p-2b-corde", F("Propagation le long d'une corde", "الانتشار على طول حبل"), "wave", { kind: "rope", N: 0.8, v: 2 },
        F("Définir une onde transversale et le retard τ = d/v.", "تعريف موجة مستعرضة والتأخر الزمني."),
        F("Mesurez le temps mis par le front d'onde pour parcourir 4 m : déduisez v.", "قس المدة التي يستغرقها مقدم الموجة لقطع 4 m واستنتج v."),
        F("La matière se déplace-t-elle avec l'onde ? Observez une perle.", "هل تنتقل المادة مع الموجة؟ لاحظ حبة واحدة.")),
      lab("p-2b-ressort", F("Onde longitudinale le long d'un ressort", "موجة طولية على نابض"), "wave", { kind: "spring", N: 1, v: 2 },
        F("Comparer onde longitudinale et onde transversale.", "مقارنة الموجة الطولية والمستعرضة."),
        F("Quelle est la direction de la perturbation par rapport à la propagation ?", "ما اتجاه التشوه بالنسبة لاتجاه الانتشار؟"),
        F("Citez un autre exemple d'onde longitudinale.", "أعط مثالا آخر لموجة طولية.")),
    ],
  },
  {
    id: "p-2b-ondes-periodiques", subject: "physics", level: "2BAC", part: F("Ondes", "الموجات"), title: F("Ondes mécaniques progressives périodiques", "الموجات الميكانيكية المتوالية الدورية"),
    labs: [
      lab("p-2b-cuve", F("Cuve à ondes : longueur d'onde", "حوض الموجات: طول الموجة"), "wave", { kind: "water", N: 1, v: 2 },
        F("Relier longueur d'onde, célérité et fréquence : λ = v/N.", "الربط بين طول الموجة وسرعة الانتشار والتردد."),
        F("Mesurez la distance entre deux crêtes successives.", "قس المسافة بين قمتين متتاليتين."),
        F("Doublez la fréquence : que devient λ ?", "ضاعف التردد: ماذا يصبح λ؟")),
      lab("p-2b-diffraction", F("Diffraction par une fente", "الحيود بشق"), "wave", { kind: "slit", N: 1, v: 2, a: 1 },
        F("Mettre en évidence la diffraction quand a est de l'ordre de λ.", "إبراز ظاهرة الحيود عندما يكون a من رتبة λ."),
        F("Comparez a et λ : la diffraction est-elle marquée ?", "قارن a و λ: هل الحيود واضح؟"),
        F("Élargissez la fente : qu'observez-vous ? La fréquence change-t-elle après la fente ?", "وسع الشق: ماذا تلاحظ؟ هل يتغير التردد بعد الشق؟")),
      lab("p-2b-interferences", F("Deux sources : interférences", "منبعان: التداخل"), "wave", { kind: "two", N: 1.2, v: 2, a: 2 },
        F("Observer des zones d'amplitude maximale et nulle (prolongement).", "ملاحظة مناطق وسع أقصى ومنعدم (تعميق)."),
        F("Repérez les lignes où la surface reste immobile.", "حدد الخطوط التي يبقى فيها السطح ساكنا."),
        F("Changez l'écart des sources : que deviennent ces lignes ?", "غير المسافة بين المنبعين: ماذا يحدث لهذه الخطوط؟")),
    ],
  },
  {
    id: "p-2b-lumiere", subject: "physics", level: "2BAC", part: F("Ondes", "الموجات"), title: F("Propagation d'une onde lumineuse", "انتشار موجة ضوئية"),
    labs: [
      lab("p-2b-prisme", F("Dispersion de la lumière blanche", "تبدد الضوء الأبيض"), "dispersion", { A: 60, i: 50 },
        F("Montrer que l'indice d'un milieu dispersif dépend de la longueur d'onde.", "بيان أن معامل الانكسار يتعلق بطول الموجة."),
        F("Quelle radiation est la plus déviée ?", "ما الإشعاع الأكثر انحرافا؟"),
        F("Passez en lumière monochromatique : observe-t-on une décomposition ?", "انتقل إلى ضوء أحادي اللون: هل يحدث تبدد؟")),
    ],
  },
  {
    id: "p-2b-nucleaire", subject: "physics", level: "2BAC", part: F("Transformations nucléaires", "التحولات النووية"), title: F("Décroissance radioactive", "التناقص الإشعاعي"),
    labs: [
      lab("p-2b-c14", F("Datation au carbone 14", "التأريخ بالكربون 14"), "decay", { nuclide: "c14", N0: 400 },
        F("Exploiter la loi de décroissance et la demi-vie pour dater un échantillon.", "استغلال قانون التناقص وعمر النصف لتأريخ عينة."),
        F("Vérifiez qu'après une demi-vie, il reste environ la moitié des noyaux.", "تحقق أنه بعد عمر النصف يتبقى تقريبا نصف النوى."),
        F("Un os contient 25 % du ¹⁴C initial : quel est son âge ?", "عظم يحتوي على 25 % من الكربون 14 البدئي: ما عمره؟"),
        F("Changez le tirage : le résultat est-il exactement le même ? Pourquoi ?", "غير السحب: هل النتيجة نفسها تماما؟ لماذا؟")),
      lab("p-2b-iode", F("Iode 131 en médecine", "اليود 131 في الطب"), "decay", { nuclide: "i131", N0: 600, speed: 3 },
        F("Calculer la constante radioactive et l'activité restante.", "حساب الثابتة الإشعاعية والنشاط المتبقي."),
        F("Calculez λ = ln2 / t½ pour l'iode 131.", "احسب λ = ln2 / t½ لليود 131."),
        F("Au bout de combien de jours reste-t-il moins de 1 % de l'activité ?", "بعد كم يوم يتبقى أقل من 1 % من النشاط؟")),
    ],
  },
  {
    id: "p-2b-rc", subject: "physics", level: "2BAC", part: F("Électricité", "الكهرباء"), title: F("Dipôle RC", "ثنائي القطب RC"),
    labs: [
      lab("p-2b-rc-charge", F("Charge d'un condensateur", "شحن مكثف"), "rc", { circuit: "rc_charge", R: 1000, C: 100, E: 6 },
        F("Déterminer τ = RC graphiquement (tangente à l'origine, 63 %).", "تحديد ثابتة الزمن مبيانيا."),
        F("Lisez τ sur la courbe et comparez à R·C.", "اقرأ τ على المنحنى وقارنه مع R·C."),
        F("Doublez R : que devient la durée de charge ?", "ضاعف R: ماذا تصبح مدة الشحن؟"),
        F("Calculez l'énergie stockée en fin de charge.", "احسب الطاقة المخزونة في نهاية الشحن.")),
      lab("p-2b-rc-decharge", F("Décharge d'un condensateur", "تفريغ مكثف"), "rc", { circuit: "rc_discharge", R: 2000, C: 50, E: 6 },
        F("Établir l'équation différentielle et vérifier la solution u_C = E·e^(−t/τ).", "إثبات المعادلة التفاضلية والتحقق من الحل."),
        F("À t = τ, quelle fraction de E reste-t-il ?", "عند t = τ ما الجزء المتبقي من E؟"),
        F("Au bout de combien de τ considère-t-on la décharge terminée ?", "بعد كم τ نعتبر التفريغ منتهيا؟")),
    ],
  },
  {
    id: "p-2b-rl", subject: "physics", level: "2BAC", part: F("Électricité", "الكهرباء"), title: F("Dipôle RL", "ثنائي القطب RL"),
    labs: [
      lab("p-2b-rl-courant", F("Établissement du courant dans une bobine", "إقامة التيار في وشيعة"), "rc", { circuit: "rl", R: 100, L: 500, E: 6 },
        F("Montrer le retard à l'établissement du courant : τ = L/R.", "بيان تأخر إقامة التيار."),
        F("Lisez la valeur du courant en régime permanent et comparez à E/R.", "اقرأ قيمة التيار في النظام الدائم وقارن مع E/R."),
        F("Augmentez L : comment évolue τ ?", "زد L: كيف تتغير τ؟")),
    ],
  },
  {
    id: "p-2b-rlc", subject: "physics", level: "2BAC", part: F("Électricité", "الكهرباء"), title: F("Oscillations libres d'un circuit RLC série", "التذبذبات الحرة في دارة RLC"),
    labs: [
      lab("p-2b-rlc-regimes", F("Les trois régimes", "الأنظمة الثلاثة"), "rlc", { L: 100, C: 10, R: 20 },
        F("Identifier les régimes périodique, pseudo-périodique et apériodique.", "التعرف على الأنظمة الدورية وشبه الدورية واللادورية."),
        F("Mettez R = 0 : quelle est la période ? Comparez à 2π√(LC).", "ضع R = 0: ما الدور؟ قارنه مع 2π√(LC)."),
        F("Augmentez R progressivement : à partir de quelle valeur n'y a-t-il plus d'oscillation ?", "زد R تدريجيا: ابتداء من أي قيمة تختفي التذبذبات؟")),
      lab("p-2b-rlc-energie", F("Échanges d'énergie dans le circuit LC", "تبادل الطاقة في الدارة LC"), "rlc", { R: 5, energy: true },
        F("Observer les échanges entre énergie électrique et magnétique.", "ملاحظة التبادل بين الطاقة الكهربائية والمغنطيسية."),
        F("Quand l'énergie électrique est maximale, que vaut l'énergie magnétique ?", "عندما تكون الطاقة الكهربائية قصوى، ما قيمة الطاقة المغنطيسية؟"),
        F("Pourquoi l'énergie totale diminue-t-elle ?", "لماذا تتناقص الطاقة الكلية؟")),
    ],
  },
  {
    id: "p-2b-chute", subject: "physics", level: "2BAC", part: F("Mécanique", "الميكانيك"), title: F("Lois de Newton : chute verticale d'un solide", "قوانين نيوتن: السقوط الرأسي لجسم صلب"),
    labs: [
      lab("p-2b-chute-libre", F("Chute libre", "السقوط الحر"), "fall", { model: "none", H: 45 },
        F("Établir v = g·t et z = ½·g·t² ; durée de chute.", "إثبات المعادلات الزمنية للسقوط الحر."),
        F("Vérifiez que la courbe v(t) est une droite de pente g.", "تحقق أن المنحنى v(t) مستقيم معامله الموجه g."),
        F("Calculez la durée de la chute pour H = 45 m.", "احسب مدة السقوط من أجل H = 45 m.")),
      lab("p-2b-chute-frottement", F("Chute avec frottement fluide : vitesse limite", "السقوط باحتكاك مائع: السرعة الحدية"), "fall", { model: "quad", m: 0.5, k: 0.05, H: 120 },
        F("Mettre en évidence le régime initial et le régime permanent.", "إبراز النظام البدئي والنظام الدائم."),
        F("Lisez la vitesse limite sur le graphique et comparez à √(m·g/k).", "اقرأ السرعة الحدية على المبيان وقارنها مع √(m·g/k)."),
        F("Passez au modèle f = k·v : la vitesse limite change-t-elle ?", "انتقل إلى النموذج f = k·v: هل تتغير السرعة الحدية؟")),
    ],
  },
  {
    id: "p-2b-mouvements-plans", subject: "physics", level: "2BAC", part: F("Mécanique", "الميكانيك"), title: F("Mouvements plans : projectile", "الحركات المستوية: القذيفة"),
    labs: [
      lab("p-2b-projectile", F("Mouvement d'un projectile dans le champ de pesanteur", "حركة قذيفة في مجال الثقالة"), "projectile", { v0: 15, alpha: 45, vectors: true },
        F("Établir les équations horaires et l'équation de la trajectoire.", "إثبات المعادلات الزمنية ومعادلة المسار."),
        F("Observez les composantes de la vitesse : laquelle reste constante ?", "لاحظ مركبتي السرعة: أيهما تبقى ثابتة؟"),
        F("Pour quel angle la portée est-elle maximale ? Activez la comparaison avec 90° − α.", "من أجل أي زاوية يكون المدى أقصى؟ فعل المقارنة مع 90° − α."),
        F("Calculez la flèche et comparez.", "احسب الذروة وقارن.")),
    ],
  },
  {
    id: "p-2b-satellites", subject: "physics", level: "2BAC", part: F("Mécanique", "الميكانيك"), title: F("Mouvement des satellites et des planètes", "حركة الأقمار الاصطناعية والكواكب"),
    labs: [
      lab("p-2b-geostationnaire", F("Satellite géostationnaire", "القمر الاصطناعي الثابت بالنسبة للأرض"), "orbit", { body: "earth", h: 35800, geo: true },
        F("Déterminer l'altitude d'un satellite géostationnaire avec la 3e loi de Kepler.", "تحديد ارتفاع القمر الثابت باستعمال قانون كيبلر الثالث."),
        F("Réglez h pour obtenir une période de 24 h environ.", "اضبط h للحصول على دور قريب من 24 h."),
        F("Pourquoi ce satellite paraît-il immobile depuis la Terre ?", "لماذا يبدو هذا القمر ساكنا بالنسبة لملاحظ أرضي؟")),
      lab("p-2b-kepler", F("Lois de Kepler : orbite elliptique", "قوانين كيبلر: مدار إهليلجي"), "orbit", { body: "sun", planet: "mars", e: 0.4, areas: true },
        F("Illustrer la loi des aires : la planète va plus vite près du Soleil.", "توضيح قانون المساحات."),
        F("Les secteurs colorés sont balayés pendant des durées égales : que remarquez-vous ?", "تمسح القطاعات الملونة خلال مدد متساوية: ماذا تلاحظ؟"),
        F("Comparez T²/r³ pour Mars et la Terre.", "قارن T²/r³ للمريخ والأرض.")),
    ],
  },
  {
    id: "p-2b-oscillants", subject: "physics", level: "2BAC", part: F("Mécanique", "الميكانيك"), title: F("Systèmes mécaniques oscillants", "المجموعات الميكانيكية المتذبذبة"),
    labs: [
      lab("p-2b-pendule", F("Période d'un pendule simple", "دور النواس البسيط"), "pendulum", { L: 1, theta: 10, energy: false },
        F("Vérifier T₀ = 2π√(L/g) et l'isochronisme des petites oscillations.", "التحقق من علاقة الدور وتواقت التذبذبات الصغيرة."),
        F("Comparez la période mesurée à T₀ pour θ₀ = 10° puis 60°.", "قارن الدور المقيس مع T₀ من أجل 10° ثم 60°."),
        F("Placez le pendule sur la Lune (g = 1,6) : que devient la période ?", "ضع النواس على القمر (g = 1,6): ماذا يصبح الدور؟")),
      lab("p-2b-ressort-osc", F("Pendule élastique", "النواس المرن"), "spring", { k: 20, m: 0.2, graph: true },
        F("Établir l'équation x(t) = Xm·cos(2πt/T₀ + φ) et vérifier T₀ = 2π√(m/k).", "إثبات المعادلة الزمنية والتحقق من الدور الخاص."),
        F("Lisez T₀ sur la courbe et comparez au calcul.", "اقرأ T₀ على المنحنى وقارنه بالحساب."),
        F("Quadruplez m : la période double-t-elle ?", "ضاعف m أربع مرات: هل يتضاعف الدور؟"),
        F("Ajoutez des frottements et décrivez le régime obtenu.", "أضف احتكاكات وصف النظام المحصل.")),
    ],
  },

  // ================================================================ CHIMIE
  {
    id: "c-tc-atome", subject: "chemistry", level: "TC", part: F("Constitution de la matière", "بنية المادة"), title: F("Modèle de l'atome", "نموذج الذرة"),
    labs: [
      lab("c-tc-atome-o", F("Structure de l'atome d'oxygène", "بنية ذرة الأكسجين"), "atom", { Z: 8 },
        F("Décrire le noyau et la répartition des électrons sur les couches.", "وصف النواة وتوزيع الإلكترونات على الطبقات."),
        F("Combien de protons, de neutrons et d'électrons ?", "كم عدد البروتونات والنوترونات والإلكترونات؟"),
        F("Écrivez la structure électronique et le nombre d'électrons de valence.", "اكتب البنية الإلكترونية وعدد إلكترونات التكافؤ.")),
      lab("c-tc-ions", F("Règles du duet et de l'octet", "قاعدتا الثنائية والثمانية"), "atom", { Z: 11 },
        F("Prévoir l'ion monoatomique formé par un élément.", "توقع الأيون الأحادي الذرة الذي يكونه عنصر."),
        F("Pour Na (Z = 11), quel ion obtient-on ? Et pour Cl (Z = 17) ?", "بالنسبة لـ Na ما الأيون المحصل؟ وبالنسبة لـ Cl؟"),
        F("Essayez Mg (12), O (8) et Al (13).", "جرب Mg و O و Al.")),
    ],
  },
  {
    id: "c-tc-classification", subject: "chemistry", level: "TC", part: F("Constitution de la matière", "بنية المادة"), title: F("Classification périodique des éléments", "الترتيب الدوري للعناصر"),
    labs: [
      lab("c-tc-familles", F("Familles chimiques", "العائلات الكيميائية"), "atom", { Z: 3 },
        F("Relier la position dans le tableau à la structure électronique.", "الربط بين الموضع في الجدول والبنية الإلكترونية."),
        F("Comparez Li (3), Na (11) et K (19) : qu'ont-ils en commun ?", "قارن Li و Na و K: ما المشترك بينها؟"),
        F("Quelle est la période de chacun ?", "ما دورة كل واحد منها؟")),
    ],
  },
  {
    id: "c-tc-molecules", subject: "chemistry", level: "TC", part: F("Constitution de la matière", "بنية المادة"), title: F("Géométrie de quelques molécules", "هندسة بعض الجزيئات"),
    labs: [
      lab("c-tc-gillespie", F("Modèle de Gillespie : H₂O, NH₃, CH₄", "نموذج جيليسبي"), "molecule", { mol: "ch4", pairs: true },
        F("Expliquer la géométrie par la répulsion des doublets.", "تفسير الهندسة بتنافر الأزواج الإلكترونية."),
        F("Observez CH₄ : 4 doublets liants, géométrie tétraédrique.", "لاحظ CH₄: 4 أزواج رابطة، هندسة رباعية الأوجه."),
        F("Passez à NH₃ puis H₂O : que deviennent la forme et l'angle ?", "انتقل إلى NH₃ ثم H₂O: ماذا يصبح الشكل والزاوية؟"),
        F("Comparez avec CO₂, linéaire.", "قارن مع CO₂ الخطية.")),
    ],
  },
  {
    id: "c-tc-cristaux", subject: "chemistry", level: "TC", part: F("Constitution de la matière", "بنية المادة"), title: F("Solides ioniques", "الأجسام الصلبة الأيونية"),
    labs: [
      lab("c-tc-nacl", F("Le cristal de chlorure de sodium", "بلورة كلورور الصوديوم"), "crystal", { type: "nacl", cells: 1 },
        F("Décrire l'empilement des ions et la neutralité électrique.", "وصف تراص الأيونات والحياد الكهربائي."),
        F("Comptez les ions Na⁺ et Cl⁻ d'une maille (1/8 pour un sommet, 1/2 pour une face…).", "عد أيونات Na⁺ و Cl⁻ في خلية."),
        F("Activez le mode compact : quels ions sont en contact ?", "فعل الوضع المتراص: ما الأيونات المتلامسة؟")),
    ],
  },
  {
    id: "c-tc-gaz", subject: "chemistry", level: "TC", part: F("Transformations de la matière", "تحولات المادة"), title: F("Grandeurs liées aux quantités de matière : gaz", "المقادير المرتبطة بكمية المادة: الغازات"),
    labs: [
      lab("c-tc-boyle", F("Loi de Boyle-Mariotte", "قانون بويل-ماريوط"), "gas", { n: 4, T: 300, V: 0.1 },
        F("Vérifier que P·V reste constant à température constante.", "التحقق من ثبات P·V عند درجة حرارة ثابتة."),
        F("Divisez le volume par deux : que devient la pression ?", "قسم الحجم على اثنين: ماذا يصبح الضغط؟"),
        F("Augmentez T : comment se comportent les molécules ?", "زد T: كيف تتصرف الجزيئات؟")),
    ],
  },
  {
    id: "c-1b-mesure", subject: "chemistry", level: "1BAC", part: F("Mesure en chimie", "القياس في الكيمياء"), title: F("Grandeurs liées aux quantités de matière", "المقادير المرتبطة بكمية المادة"),
    labs: [
      lab("c-1b-gaz-parfait", F("Équation d'état des gaz parfaits", "معادلة الحالة للغازات الكاملة"), "gas", { n: 8, T: 350, V: 0.2 },
        F("Calculer une quantité de matière gazeuse avec P·V = n·R·T.", "حساب كمية مادة غازية."),
        F("Calculez n à partir de P, V et T affichés.", "احسب n انطلاقا من P و V و T المعروضة."),
        F("Calculez le volume molaire à 0 °C (273 K) et sous 1 bar.", "احسب الحجم المولي عند 0 °C وتحت 1 bar.")),
      lab("c-1b-dosage-fort", F("Dosage direct d'un acide fort", "المعايرة المباشرة لحمض قوي"), "titration", { acid: "strong", Ca: 0.05, Va: 20, Cb: 0.1, indicator: "bbt" },
        F("Déterminer une concentration inconnue par dosage : à l'équivalence, nₐ = n_B.", "تحديد تركيز مجهول بالمعايرة."),
        F("Relevez le volume à l'équivalence et calculez Cₐ.", "سجل حجم التكافؤ واحسب Cₐ."),
        F("Pourquoi le bleu de bromothymol convient-il ici ?", "لماذا يناسب أزرق البروموتيمول هنا؟")),
    ],
  },
  {
    id: "c-1b-organique", subject: "chemistry", level: "1BAC", part: F("Chimie organique", "الكيمياء العضوية"), title: F("Squelette carboné et groupes caractéristiques", "الهيكل الكربوني والمجموعات المميزة"),
    labs: [
      lab("c-1b-isomeres", F("Isomères du butane", "متماكبات البوتان"), "molecule", { mol: "butane" },
        F("Reconnaître des isomères de chaîne (même formule brute, chaînes différentes).", "التعرف على متماكبات السلسلة."),
        F("Comparez la formule brute du butane et du méthylpropane.", "قارن الصيغة الإجمالية للبوتان ومثيل البروبان."),
        F("Dessinez la formule semi-développée de chacun.", "ارسم الصيغة نصف المنشورة لكل منهما.")),
      lab("c-1b-insaturation", F("Liaisons simples, doubles et triples", "الروابط الأحادية والثنائية والثلاثية"), "molecule", { mol: "c2h4" },
        F("Relier la nature de la liaison C–C à la géométrie.", "الربط بين طبيعة الرابطة والهندسة."),
        F("Comparez éthane, éthène et éthyne : angles et forme.", "قارن الإيثان والإيثين والإيثين الثلاثي."),
        F("Quelle molécule est plane ? Laquelle est linéaire ?", "أي جزيئة مستوية؟ وأيها خطية؟")),
      lab("c-1b-groupes", F("Groupes caractéristiques", "المجموعات المميزة"), "molecule", { mol: "ethanol" },
        F("Identifier les familles : alcool, aldéhyde, cétone, acide carboxylique, amine.", "التعرف على العائلات العضوية."),
        F("Repérez le groupe –OH de l'éthanol.", "حدد المجموعة –OH في الإيثانول."),
        F("Passez à l'éthanal, la propanone, l'acide éthanoïque, l'éthylamine : nommez chaque groupe.", "انتقل إلى الإيثانال والبروبانون وحمض الإيثانويك والإيثيل أمين وسم كل مجموعة.")),
    ],
  },
  {
    id: "c-2b-cinetique", subject: "chemistry", level: "2BAC", part: F("Transformations rapides et lentes", "التحولات السريعة والبطيئة"), title: F("Suivi temporel et vitesse de réaction", "التتبع الزمني وسرعة التفاعل"),
    labs: [
      lab("c-2b-demi-reaction", F("Temps de demi-réaction", "زمن نصف التفاعل"), "kinetics", { C0: 20, T: 25, k25: 0.1 },
        F("Déterminer t½ et la vitesse volumique à partir de la courbe x(t).", "تحديد زمن نصف التفاعل والسرعة الحجمية."),
        F("Lisez t½ sur la courbe (x = x_max/2).", "اقرأ t½ على المنحنى."),
        F("Comment évolue la pente de la tangente au cours du temps ? Interprétez.", "كيف يتغير ميل المماس مع الزمن؟ فسر.")),
      lab("c-2b-temperature", F("Facteur cinétique : la température", "العامل الحركي: درجة الحرارة"), "kinetics", { T: 45 },
        F("Montrer que la température accélère la transformation.", "بيان أن درجة الحرارة تسرع التحول."),
        F("Comparez t½ à 25 °C et à 45 °C.", "قارن t½ عند 25 °C و 45 °C."),
        F("Pourquoi refroidit-on brusquement un prélèvement avant de le doser (trempe) ?", "لماذا نبرد العينة فجأة قبل معايرتها؟")),
    ],
  },
  {
    id: "c-2b-acides", subject: "chemistry", level: "2BAC", part: F("Transformations non totales", "التحولات غير الكلية"), title: F("Dosage acido-basique et pH", "المعايرة حمض-قاعدة و pH"),
    labs: [
      lab("c-2b-acide-faible", F("Dosage d'un acide faible : pKa", "معايرة حمض ضعيف: pKa"), "titration", { acid: "weak", Ca: 0.05, Va: 20, Cb: 0.1, pKa: 4.8, indicator: "phenol" },
        F("Déterminer Vₑ et le pKa (pH à la demi-équivalence).", "تحديد حجم التكافؤ و pKa."),
        F("Relevez le point d'équivalence : pourquoi pH_E > 7 ?", "سجل نقطة التكافؤ: لماذا pH_E > 7؟"),
        F("Lisez le pH à la demi-équivalence et comparez au pKa.", "اقرأ pH عند نصف التكافؤ وقارنه مع pKa.")),
      lab("c-2b-indicateur", F("Choisir un indicateur coloré", "اختيار كاشف ملون"), "titration", { acid: "weak", indicator: "helianthine" },
        F("Justifier le choix de l'indicateur par sa zone de virage.", "تعليل اختيار الكاشف بمنطقة انعطافه."),
        F("L'hélianthine convient-elle ici ? Observez la couleur au moment de l'équivalence.", "هل يناسب الهيليانتين هنا؟ لاحظ اللون عند التكافؤ."),
        F("Essayez les trois indicateurs et concluez.", "جرب الكواشف الثلاثة واستنتج.")),
    ],
  },
  {
    id: "c-2b-piles", subject: "chemistry", level: "2BAC", part: F("Sens d'évolution d'un système", "منحى تطور مجموعة كيميائية"), title: F("Piles et électrolyse", "الأعمدة والتحليل الكهربائي"),
    labs: [
      lab("c-2b-daniell", F("La pile Daniell", "عمود دانيال"), "electrochem", { mode: "pile", I: 100, t: 30 },
        F("Décrire le fonctionnement d'une pile : électrodes, pont salin, porteurs de charge.", "وصف اشتغال عمود."),
        F("Quel est le pôle négatif ? Écrivez les demi-équations.", "ما القطب السالب؟ اكتب نصفي المعادلتين."),
        F("Calculez la masse de zinc consommée en 30 min sous 100 mA.", "احسب كتلة الزنك المستهلكة خلال 30 min تحت 100 mA."),
        F("Quel est le rôle du pont salin ?", "ما دور القنطرة الملحية؟")),
      lab("c-2b-electrolyse", F("Électrolyse d'une solution de chlorure de cuivre", "التحليل الكهربائي لمحلول كلورور النحاس"), "electrochem", { mode: "electrolyse", I: 200, t: 20 },
        F("Comprendre une transformation forcée et faire un bilan de matière.", "فهم التحول القسري وإنجاز حصيلة المادة."),
        F("À quelle électrode se dépose le cuivre ? Que se dégage-t-il à l'autre ?", "على أي إلكترود يترسب النحاس؟ وماذا ينطلق عند الآخر؟"),
        F("Calculez le volume de dichlore formé.", "احسب حجم ثنائي الكلور المتكون.")),
    ],
  },
  {
    id: "c-2b-esters", subject: "chemistry", level: "2BAC", part: F("Contrôle de l'évolution", "التحكم في تطور المجموعات"), title: F("Estérification et hydrolyse", "الأسترة والحلمأة"),
    labs: [
      lab("c-2b-ester", F("Structure d'un ester", "بنية إستر"), "molecule", { mol: "ester" },
        F("Identifier le groupe ester et retrouver l'acide et l'alcool dont il provient.", "التعرف على مجموعة الإستر وإيجاد الحمض والكحول."),
        F("Repérez le groupe –COO– dans l'éthanoate d'éthyle.", "حدد المجموعة –COO– في إيثانوات الإيثيل."),
        F("Affichez l'acide éthanoïque puis l'éthanol : écrivez l'équation d'estérification.", "اعرض حمض الإيثانويك ثم الإيثانول واكتب معادلة الأسترة.")),
    ],
  },

  // ================================================================ SVT
  {
    id: "s-tc-ecologie", subject: "svt", level: "TC", part: F("Écologie", "علم البيئة"), title: F("Flux de matière et d'énergie dans un écosystème", "تدفق المادة والطاقة في وسط بيئي"),
    labs: [
      lab("s-tc-pyramide", F("Pyramide des énergies", "هرم الطاقة"), "ecopyramid", { P: 20000, eff: 10, levels: 4 },
        F("Calculer un rendement écologique et expliquer la forme de la pyramide.", "حساب المردود البيئي وتفسير شكل الهرم."),
        F("Calculez l'énergie disponible pour les carnivores.", "احسب الطاقة المتوفرة للاحمات."),
        F("Où passe l'énergie perdue à chaque niveau ?", "أين تذهب الطاقة المفقودة في كل مستوى؟"),
        F("Passez en échelle linéaire : pourquoi utilise-t-on souvent une échelle logarithmique ?", "انتقل إلى السلم الخطي: لماذا نستعمل غالبا السلم اللوغاريتمي؟")),
    ],
  },
  {
    id: "s-tc-cellule", subject: "svt", level: "TC", part: F("Le vivant", "الكائن الحي"), title: F("La cellule, unité du vivant", "الخلية، وحدة الكائن الحي"),
    labs: [
      lab("s-tc-cellules", F("Cellule animale et cellule végétale", "الخلية الحيوانية والنباتية"), "cell", { type: "plant", cut: true },
        F("Comparer l'ultrastructure des cellules animale et végétale.", "مقارنة البنية الدقيقة للخليتين."),
        F("Repérez les organites propres à la cellule végétale.", "حدد العضيات الخاصة بالخلية النباتية."),
        F("Passez à la cellule animale : quels organites sont communs ?", "انتقل إلى الخلية الحيوانية: ما العضيات المشتركة؟")),
    ],
  },
  {
    id: "s-tc-reproduction", subject: "svt", level: "TC", part: F("Reproduction des plantes", "التوالد عند النباتات"), title: F("La fleur et la reproduction sexuée", "الزهرة والتوالد الجنسي"),
    labs: [
      lab("s-tc-fleur", F("Dissection d'une fleur", "تشريح زهرة"), "flower", { open: 0.5, cut: true },
        F("Identifier les pièces florales et établir la formule florale.", "التعرف على الأجزاء الزهرية وإعداد الصيغة الزهرية."),
        F("Écartez progressivement les verticilles : nommez-les de l'extérieur vers l'intérieur.", "أبعد الدوائر تدريجيا وسمها من الخارج نحو الداخل."),
        F("Quels sont les organes mâles et femelles ? Que devient l'ovaire après la fécondation ?", "ما الأعضاء الذكرية والأنثوية؟ وماذا يصبح المبيض بعد الإخصاب؟")),
    ],
  },
  {
    id: "s-1b-geologie-externe", subject: "svt", level: "1BAC", part: F("Phénomènes géologiques externes", "الظواهر الجيولوجية الخارجية"), title: F("Stratigraphie et histoire d'une région sédimentaire", "علم الطبقات وتاريخ منطقة رسوبية"),
    labs: [
      lab("s-1b-strates", F("Série sédimentaire tabulaire et érosion", "سلسلة رسوبية أفقية والتعرية"), "geology", { mode: "strata", amount: 0.6 },
        F("Appliquer les principes de superposition et de continuité.", "تطبيق مبدأي التراكب والاستمرارية."),
        F("Classez les couches de la plus ancienne à la plus récente.", "رتب الطبقات من الأقدم إلى الأحدث."),
        F("Creusez la vallée : comment savoir que les couches des deux versants sont les mêmes ?", "عمق الوادي: كيف نعرف أن طبقات الجانبين هي نفسها؟")),
    ],
  },
  {
    id: "s-1b-photosynthese", subject: "svt", level: "1BAC", part: F("Production de la matière organique", "إنتاج المادة العضوية"), title: F("Photosynthèse : le chloroplaste", "التركيب الضوئي: الصانعة الخضراء"),
    labs: [
      lab("s-1b-chloroplaste", F("Ultrastructure du chloroplaste", "البنية الدقيقة للصانعة الخضراء"), "organelle", { mode: "chloroplast" },
        F("Localiser les phases claire et sombre de la photosynthèse.", "تحديد موقع المرحلتين المضيئة والمظلمة."),
        F("Repérez thylakoïdes, grana et stroma.", "حدد الكييسات والبذيرات والحشوة."),
        F("Où se déroule la photolyse de l'eau ? Et la fixation du CO₂ ?", "أين يتم التحلل الضوئي للماء؟ وتثبيت CO₂؟")),
    ],
  },
  {
    id: "s-1b-nerveux", subject: "svt", level: "1BAC", part: F("Communication nerveuse", "التواصل العصبي"), title: F("Le message nerveux", "الرسالة العصبية"),
    labs: [
      lab("s-1b-neurone", F("Propagation du potentiel d'action", "انتشار جهد العمل"), "neuron", { myelin: true, speed: 50 },
        F("Comparer la conduction continue et la conduction saltatoire.", "مقارنة التوصيل المستمر والتوصيل القفزي."),
        F("Décrivez les phases du potentiel d'action enregistré.", "صف مراحل جهد العمل المسجل."),
        F("Désactivez la myéline et réduisez la vitesse : que remarquez-vous ?", "أزل النخاعين وخفض السرعة: ماذا تلاحظ؟"),
        F("Comment le message nerveux est-il codé ?", "كيف تُرمز الرسالة العصبية؟")),
    ],
  },
  {
    id: "s-2b-energie", subject: "svt", level: "2BAC", part: F("Consommation de la matière organique", "استهلاك المادة العضوية"), title: F("Respiration cellulaire et contraction musculaire", "التنفس الخلوي والتقلص العضلي"),
    labs: [
      lab("s-2b-mitochondrie", F("La mitochondrie", "الميتوكوندري"), "organelle", { mode: "mitochondria" },
        F("Relier la structure de la mitochondrie aux étapes de la respiration.", "ربط بنية الميتوكوندري بمراحل التنفس."),
        F("Où se déroule le cycle de Krebs ? La chaîne respiratoire ?", "أين تتم حلقة كريبس؟ والسلسلة التنفسية؟"),
        F("Comparez le rendement énergétique de la respiration et de la fermentation.", "قارن المردود الطاقي للتنفس والتخمر.")),
      lab("s-2b-sarcomere", F("Contraction du sarcomère", "تقلص القسيم العضلي"), "organelle", { mode: "sarcomere", contraction: 0.8 },
        F("Expliquer la contraction par le glissement des filaments.", "تفسير التقلص بانزلاق الخييطات."),
        F("Quelles bandes raccourcissent pendant la contraction ? Laquelle garde sa longueur ?", "ما الأشرطة التي تقصر خلال التقلص؟ وأيها يحتفظ بطوله؟"),
        F("Quel est le rôle de l'ATP et des ions Ca²⁺ ?", "ما دور ATP وأيونات Ca²⁺؟")),
    ],
  },
  {
    id: "s-2b-adn", subject: "svt", level: "2BAC", part: F("Information génétique", "الخبر الوراثي"), title: F("Nature et expression de l'information génétique", "طبيعة الخبر الوراثي وتعبيره"),
    labs: [
      lab("s-2b-double-helice", F("Structure de l'ADN", "بنية ADN"), "dna", { mode: "helix" },
        F("Décrire la double hélice et la complémentarité des bases.", "وصف اللولب المزدوج وتكامل القواعد."),
        F("Écrivez le brin complémentaire de la séquence affichée.", "اكتب اللولب المكمل للمتتالية المعروضة."),
        F("Calculez le pourcentage de (G + C).", "احسب النسبة المئوية لـ (G + C).")),
      lab("s-2b-replication", F("Réplication semi-conservative", "التضاعف نصف المحافظ"), "dna", { mode: "replication", open: 0.7 },
        F("Montrer que chaque molécule fille garde un brin parental.", "بيان أن كل جزيئة بنت تحتفظ بلولب أبوي."),
        F("Ouvrez la molécule : quelles bases viennent se placer en face ?", "افتح الجزيئة: ما القواعد التي تتموضع مقابلها؟"),
        F("À quel moment du cycle cellulaire a lieu la réplication ?", "في أي مرحلة من الدورة الخلوية يتم التضاعف؟")),
      lab("s-2b-traduction", F("Transcription et traduction", "الاستنساخ والترجمة"), "dna", { mode: "transcription", open: 0.8, seq: "TACAAGCTTGGAATT" },
        F("Passer de l'ADN à l'ARNm puis à la protéine avec le code génétique.", "الانتقال من ADN إلى ARNm ثم إلى البروتين."),
        F("Écrivez l'ARNm correspondant et découpez-le en codons.", "اكتب ARNm الموافق وقسمه إلى وحدات رمزية."),
        F("Modifiez une base (mutation) : la protéine change-t-elle ?", "غير قاعدة واحدة (طفرة): هل يتغير البروتين؟")),
      lab("s-2b-mitose", F("Les étapes de la mitose", "مراحل الانقسام غير المباشر"), "division", { type: "mitosis", phase: 0.5, pairs: 2 },
        F("Décrire le comportement des chromosomes à chaque phase.", "وصف سلوك الصبغيات في كل مرحلة."),
        F("Faites défiler les phases et nommez-les.", "مرر المراحل وسمها."),
        F("Comparez le nombre de chromosomes de la cellule mère et des cellules filles.", "قارن عدد صبغيات الخلية الأم والخليتين البنتين.")),
    ],
  },
  {
    id: "s-2b-genetique", subject: "svt", level: "2BAC", part: F("Information génétique", "الخبر الوراثي"), title: F("Transfert de l'information génétique : méiose et lois de Mendel", "انتقال الخبر الوراثي: الانقسام الاختزالي وقوانين ماندل"),
    labs: [
      lab("s-2b-meiose", F("La méiose et les brassages", "الانقسام الاختزالي والتخليط"), "division", { type: "meiosis", phase: 0.2, pairs: 2, crossing: true },
        F("Expliquer la réduction chromatique et les brassages inter- et intrachromosomiques.", "تفسير الاختزال الصبغي والتخليط."),
        F("En prophase I, repérez le crossing-over.", "في التمهيدية I حدد العبور."),
        F("Comparez le nombre de chromosomes après la division I et après la division II.", "قارن عدد الصبغيات بعد الانقسام I وبعد الانقسام II.")),
      lab("s-2b-monohybridisme", F("Monohybridisme et dominance", "الهجونة الأحادية والسيادة"), "punnett", { cross: "mono", dominance: "complete" },
        F("Interpréter les proportions 3/4 – 1/4 en F2.", "تفسير النسب 3/4 – 1/4 في الجيل الثاني."),
        F("Écrivez les gamètes de F1 et remplissez l'échiquier.", "اكتب أمشاج F1 واملأ شبكة التزاوج."),
        F("Passez en codominance : quelles proportions obtient-on ?", "انتقل إلى تساوي السيادة: ما النسب المحصلة؟"),
        F("Réalisez un croisement-test : à quoi sert-il ?", "أنجز تزاوجا اختباريا: ما فائدته؟")),
      lab("s-2b-dihybridisme", F("Dihybridisme : gènes indépendants", "الهجونة الثنائية: مورثات مستقلة"), "punnett", { cross: "di" },
        F("Retrouver les proportions 9/16 – 3/16 – 3/16 – 1/16.", "إيجاد النسب 9/16 – 3/16 – 3/16 – 1/16."),
        F("Combien de types de gamètes un double hétérozygote produit-il ?", "كم نوعا من الأمشاج ينتج فرد مختلف الاقتران مرتين؟"),
        F("Comparez avec le croisement-test (1/4 de chaque phénotype).", "قارن مع التزاوج الاختباري.")),
    ],
  },
  {
    id: "s-2b-tectonique", subject: "svt", level: "2BAC", part: F("Géologie", "الجيولوجيا"), title: F("Chaînes de montagnes et tectonique des plaques", "السلاسل الجبلية وتكتونية الصفائح"),
    labs: [
      lab("s-2b-globe", F("Structure interne du globe", "البنية الداخلية للأرض"), "geology", { mode: "globe" },
        F("Décrire les enveloppes de la Terre et leurs limites.", "وصف أغلفة الأرض وحدودها."),
        F("Nommez les couches de la surface vers le centre.", "سم الطبقات من السطح نحو المركز."),
        F("Quelle enveloppe est liquide ? Comment le sait-on ?", "أي غلاف سائل؟ وكيف نعرف ذلك؟")),
      lab("s-2b-subduction", F("Chaînes de subduction", "سلاسل الطمر"), "geology", { mode: "subduction", amount: 0.6 },
        F("Identifier les indices géologiques d'une zone de subduction.", "التعرف على المؤشرات الجيولوجية لمنطقة طمر."),
        F("Comment évolue la profondeur des séismes en s'éloignant de la fosse ?", "كيف يتغير عمق الزلازل عند الابتعاد عن الخندق؟"),
        F("Expliquez l'origine du magmatisme sous les volcans.", "فسر أصل الصهارة تحت البراكين.")),
      lab("s-2b-collision", F("Chaînes de collision", "سلاسل الاصطدام"), "geology", { mode: "collision", amount: 0.7 },
        F("Expliquer la formation d'une chaîne de collision et de sa racine.", "تفسير تكون سلسلة اصطدام وجذرها."),
        F("Que représentent les ophiolites au cœur de la chaîne ?", "ماذا تمثل الأفيوليت في قلب السلسلة؟"),
        F("Augmentez la convergence : comment évoluent les reliefs et la racine ?", "زد التقارب: كيف تتطور التضاريس والجذر؟")),
      lab("s-2b-plis-failles", F("Plis et failles", "الطيات والفوالق"), "geology", { mode: "fold", amount: 0.6 },
        F("Distinguer déformation souple (pli) et cassante (faille).", "التمييز بين التشوه اللين (الطية) والقصيف (الفالق)."),
        F("Repérez l'anticlinal et le synclinal. Où sont les couches les plus anciennes ?", "حدد المحدب والمقعر. أين توجد الطبقات الأقدم؟"),
        F("Passez au mode « Faille » : comparez faille normale et faille inverse.", "انتقل إلى وضع الفالق: قارن الفالق العادي والمعكوس.")),
    ],
  },
];

export const ALL_LABS: (LabEntry & { lesson: LabLesson })[] = LESSONS.flatMap((l) => l.labs.map((x) => ({ ...x, lesson: l })));
export const labById = (id: string | null | undefined) => (id ? ALL_LABS.find((l) => l.id === id) || null : null);
/** « 🧬 2e année Bac · Nature et expression… » pour une scène créée depuis la bibliothèque */
export const labLessonLabel = (labId: string | null | undefined, L: (t: Tri) => string) => {
  const lab = labById(labId);
  if (!lab) return null;
  const subject = SUBJECTS.find((s) => s.id === lab.lesson.subject);
  const level = LEVELS.find((l) => l.id === lab.lesson.level);
  return `${subject?.icon ?? ""} ${level ? L(level.label) : ""} · ${L(lab.lesson.title)}`;
};
