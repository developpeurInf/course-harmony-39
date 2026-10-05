import { GlobalDiagnosticStats, ClassStats } from "./diagnosticStatsEngine";

export type DiagLang = "fr" | "ar" | "en";

export interface DiagnosticI18n {
  appTitle: string;
  appEdition: string;
  appSubtitle: string;
  connectedToClassManagement: string;
  demoModeBadge: string;
  refreshBtn: string;
  toggleDemoBtn: string;
  downloadExcelTemplateBtn: string;
  printPdfBtn: string;
  downloadPdfBtn: string;
  downloadingPdfMsg: string;
  
  // Tabs
  tabClasses: string;
  tabNotes: string;
  tabStats: string;
  tabObservations: string;
  tabConfig: string;
  tabPreview: string;

  // Scope & Filters
  scopeLabel: string;
  scopeAllClasses: string;
  scopeSingleClass: string;
  scopeCustom: string;
  selectAllBtn: string;
  deselectAllBtn: string;
  selectedClassesCount: string;
  includeGraphsInReportLabel: string;
  includeGraphsDesc: string;

  // Tab 1 Classes
  classesHeaderTitle: string;
  classesHeaderSubtitle: string;
  addClassBtn: string;
  classDateLabel: string;
  totalStudentsLabel: string;
  presentCountLabel: string;
  absentCountLabel: string;
  averageNoteLabel: string;
  enterNotesBtn: string;
  importExcelBtn: string;
  downloadClassTemplateBtn: string;
  editClassBtn: string;
  deleteClassBtn: string;
  noClassesMessage: string;

  // Tab 2 Notes & Grading Modes
  selectClassLabel: string;
  gradingModeLabel: string;
  manualModeLabel: string;
  quizModeLabel: string;
  selectQuizLabel: string;
  syncQuizBtn: string;
  syncingQuizMsg: string;
  quizModeDesc: string;
  importFromQuizBtn: string;
  noQuizAvailableForClass: string;
  addStudentBtn: string;
  saveNotesBtn: string;
  numCol: string;
  massarCol: string;
  studentNameCol: string;
  noteCol: string;
  trancheCol: string;
  actionsCol: string;
  notGradedBadge: string;
  absentBadge: string;
  setAbsBtn: string;
  noStudentsMessage: string;

  // Tab 3 Stats & KPIs
  statsKpiTotalPresents: string;
  statsKpiStrugglingRate: string;
  statsKpiAppreciation: string;
  statsKpiClassesCount: string;
  kpiSuccessRate: string;
  kpiAverageGrade: string;
  chartDistributionTitle: string;
  chartDistributionSubtitle: string;
  chartColumnsTitle: string;
  chartPieTitle: string;
  officialTableTitle: string;
  officialTableSubtitle: string;
  indicatorCol: string;
  countRow: string;
  percentageRow: string;

  // Tranches
  tranche1Name: string; // المتعثرون
  tranche2Name: string; // المسايرون
  tranche3Name: string; // المتفوقون
  tranche4Name: string; // المتميزون

  // Tab 4 Observations
  globalAppreciationTitle: string;
  globalAppreciationSubtitle: string;
  useCalculatedAppreciationBtn: string;
  testCompositionTitle: string;
  testCompositionSubtitle: string;
  numExercisesLabel: string;
  addExerciseBtn: string;
  observationsTitle: string;
  observationsSubtitle: string;
  addObservationBtn: string;
  propositionsTitle: string;
  propositionsSubtitle: string;
  addPropositionBtn: string;

  // Tab 5 Config
  adminConfigTitle: string;
  academieLabel: string;
  directionLabel: string;
  lyceeLabel: string;
  anneeScolaireLabel: string;
  pedagogicalConfigTitle: string;
  teacherNameLabel: string;
  subjectLabel: string;
  gradeLevelLabel: string;
  titleHeaderLabel: string;
  diagnosticPeriodLabel: string;
  section1ClassesLabel: string;
  resetDefaultsBtn: string;
  saveConfigBtn: string;

  // Tab 6 Preview & Print
  previewHeaderTitle: string;
  previewHeaderSubtitle: string;
  backToEditBtn: string;
  printDocumentBtn: string;

  // Report Specific
  reportTitlePrefix: string;
  reportTeacherPrefix: string;
  reportSubjectPrefix: string;
  reportLevelPrefix: string;
  reportObjectivesTitle: string;
  reportSection1Title: string;
  reportSection1Intro: string;
  reportSection2Title: string;
  reportTable1ClassCol: string;
  reportTable1DateCol: string;
  reportTable1PresentsCol: string;
  reportTable1TotalRow: string;
  reportCompositionPrefix: string;
  reportResultsTitle: string;
  reportResultsIntroPrefix: string;
  reportSection3Title: string;
  reportSection3Intro: string;
  reportSignatureTitle: string;

  // Analytical Paragraph Section
  analysisSectionTitle: string;
  analysisSectionSubtitle: string;

  // Listes par défaut adaptées à la langue
  defaultObservations: string[];
  defaultPropositions: string[];
  defaultExercises: Array<{ titre: string; description: string }>;
}

export const DIAGNOSTIC_TRANSLATIONS: Record<DiagLang, DiagnosticI18n> = {
  fr: {
    appTitle: "DiagEval Pro",
    appEdition: "Édition Maroc",
    appSubtitle: "Évaluation diagnostique conforme à la décision ministérielle (Article 08) & Rapport officiel",
    connectedToClassManagement: "Connecté à Class Management",
    demoModeBadge: "Mode Démonstration (2Bac)",
    refreshBtn: "Actualiser",
    toggleDemoBtn: "Basculer Démo/Réel",
    downloadExcelTemplateBtn: "Modèle Excel Massar",
    printPdfBtn: "Imprimer",
    downloadPdfBtn: "Télécharger le Rapport (PDF)",
    downloadingPdfMsg: "Génération du PDF en cours...",

    tabClasses: "1. Classes & Élèves",
    tabNotes: "2. Saisie des Notes",
    tabStats: "3. Statistiques & Tranches",
    tabObservations: "4. Résultats & Remédiation",
    tabConfig: "5. Paramètres",
    tabPreview: "6. Rapport Officiel (PDF)",

    scopeLabel: "Périmètre du Rapport :",
    scopeAllClasses: "Toutes les classes (Rapport Total)",
    scopeSingleClass: "Par classe",
    scopeCustom: "Sélection personnalisée",
    selectAllBtn: "Tout sélectionner",
    deselectAllBtn: "Tout désélectionner",
    selectedClassesCount: "classe(s) sélectionnée(s)",
    includeGraphsInReportLabel: "Inclure les graphiques & l'analyse statistique dans le rapport",
    includeGraphsDesc: "Insère des diagrammes en colonnes et circulaires avec une analyse pédagogique rédigée dans le document.",

    classesHeaderTitle: "Classes de l'établissement & Élèves",
    classesHeaderSubtitle: "Ces classes sont directement reliées à vos salles de cours de Class Management. Les notes saisies ici sont calculées pour le rapport d'inspection.",
    addClassBtn: "Ajouter une classe",
    classDateLabel: "Date de passation :",
    totalStudentsLabel: "Élèves inscrits",
    presentCountLabel: "Présents / Notés",
    absentCountLabel: "Absents",
    averageNoteLabel: "Moyenne diagnostique",
    enterNotesBtn: "Saisir Notes",
    importExcelBtn: "Importer Excel",
    downloadClassTemplateBtn: "Gabarit Excel",
    editClassBtn: "Modifier",
    deleteClassBtn: "Retirer",
    noClassesMessage: "Aucune classe trouvée. Ajoutez une classe ou synchronisez depuis Class Management.",

    selectClassLabel: "Classe active :",
    gradingModeLabel: "Mode d'attribution des notes :",
    manualModeLabel: "Saisie manuelle & Gabarit Excel",
    quizModeLabel: "Importer depuis un Quiz de la plateforme",
    selectQuizLabel: "Sélectionner le Quiz :",
    syncQuizBtn: "Synchroniser les notes du Quiz",
    syncingQuizMsg: "Récupération des notes du quiz...",
    quizModeDesc: "Les élèves ayant complété ce quiz recevront leur note sur 20 calculée automatiquement. Les élèves sans soumission seront marqués ABS (Absent).",
    importFromQuizBtn: "Lier à un Quiz",
    noQuizAvailableForClass: "Aucun quiz trouvé pour cette classe. Vous pouvez en sélectionner un autre ou créer un quiz dans la section Examens.",
    addStudentBtn: "Ajouter un élève",
    saveNotesBtn: "Enregistrer les notes",
    numCol: "N°",
    massarCol: "Code Massar / ID",
    studentNameCol: "Nom et Prénom de l'Élève",
    noteCol: "Note / 20",
    trancheCol: "Tranche Officielle",
    actionsCol: "Actions",
    notGradedBadge: "Non noté",
    absentBadge: "Absent (ABS)",
    setAbsBtn: "ABS",
    noStudentsMessage: "Aucun élève dans cette classe. Ajoutez des élèves ou importez une liste Excel.",

    statsKpiTotalPresents: "Total Apprenants Présents",
    statsKpiStrugglingRate: "Taux d'Élèves en Difficulté (≤8/20)",
    statsKpiAppreciation: "Appréciation Globale Déduite",
    statsKpiClassesCount: "Classes Évaluées",
    kpiSuccessRate: "Taux de Maîtrise (≥10/20)",
    kpiAverageGrade: "Moyenne Générale",
    chartDistributionTitle: "Répartition par Classe et par Tranche Officielle",
    chartDistributionSubtitle: "Nombre d'apprenants dans chacune des 4 tranches ministérielles",
    chartColumnsTitle: "Diagramme en Colonnes des 4 Tranches",
    chartPieTitle: "Distribution Globale de l'Évaluation",
    officialTableTitle: "Tableau Officiel des Résultats (Conforme au Rapport d'Inspection)",
    officialTableSubtitle: "Présentation réglementaire avec effectifs et pourcentages ajustés à 100%",
    indicatorCol: "Indicateur",
    countRow: "Nombre",
    percentageRow: "Pourcentage %",

    tranche1Name: "En difficulté [0 – 8]",
    tranche2Name: "En progression [8 – 12]",
    tranche3Name: "Maîtrise satisfaisante [12 – 14]",
    tranche4Name: "Excellence [14 – 20]",

    globalAppreciationTitle: "Appréciation Globale du Diagnostic",
    globalAppreciationSubtitle: "Cette appréciation s'insère dans l'introduction des résultats sur la Page 2 du rapport officiel.",
    useCalculatedAppreciationBtn: "Utiliser la valeur calculée",
    testCompositionTitle: "Composition du Test Évaluatif",
    testCompositionSubtitle: "Détaillez les exercices constituant le test diagnostique (affichés dans le Tableau de la Section I).",
    numExercisesLabel: "Nombre d'exercices (en lettres) :",
    addExerciseBtn: "Ajouter un exercice",
    observationsTitle: "Observations Pédagogiques Constatées",
    observationsSubtitle: "Constats diagnostiques sur les difficultés des élèves (Page 2 du rapport).",
    addObservationBtn: "Ajouter une observation",
    propositionsTitle: "Propositions de Soutien & Remédiation",
    propositionsSubtitle: "Actions pédagogiques proposées pour combler les lacunes identifiées (Section III du rapport).",
    addPropositionBtn: "Ajouter une proposition",

    adminConfigTitle: "Informations Administratives & Académiques",
    academieLabel: "Académie Régionale :",
    directionLabel: "Direction Provinciale :",
    lyceeLabel: "Établissement / Lycée :",
    anneeScolaireLabel: "Année Scolaire :",
    pedagogicalConfigTitle: "Données Pédagogiques & Enseignant",
    teacherNameLabel: "Nom de l'Enseignant (Pr) :",
    subjectLabel: "Matière :",
    gradeLevelLabel: "Niveau :",
    titleHeaderLabel: "Intitulé dans le Titre :",
    diagnosticPeriodLabel: "Période du Diagnostic :",
    section1ClassesLabel: "Classes Mentionnées Section 1 :",
    resetDefaultsBtn: "Réinitialiser paramètres",
    saveConfigBtn: "Enregistrer la configuration",

    previewHeaderTitle: "Aperçu Conforme au Document Officiel (Format A4)",
    previewHeaderSubtitle: "Prévisualisez le rapport tel qu'il sera imprimé ou généré en PDF. Cliquez sur « Imprimer » pour exporter.",
    backToEditBtn: "Retour à l'édition",
    printDocumentBtn: "Imprimer le Rapport",

    reportTitlePrefix: "Rapport d’évaluation diagnostique –",
    reportTeacherPrefix: "Pr :",
    reportSubjectPrefix: "Matière :",
    reportLevelPrefix: "Niveau :",
    reportObjectivesTitle: "Objectifs de l’évaluation diagnostique :",
    reportSection1Title: "I. Informations générales sur l’évaluation diagnostique",
    reportSection1Intro: "Le tableau suivant résume la planification de l’évaluation diagnostique et le nombre des apprenants présents :",
    reportSection2Title: "II. Analyse des résultats de l’évaluation diagnostique",
    reportTable1ClassCol: "La classe",
    reportTable1DateCol: "Date de la procédure",
    reportTable1PresentsCol: "Nombre des apprenants présents",
    reportTable1TotalRow: "La somme",
    reportCompositionPrefix: "- Composition de test : c’est une évaluation du",
    reportResultsTitle: "Résultats :",
    reportResultsIntroPrefix: "Après que les apprenants aient passé ce test, on constate que les résultats obtenus sont",
    reportSection3Title: "➢ III. Propositions :",
    reportSection3Intro: "Pour surmonter ces obstacles, on propose de :",
    reportSignatureTitle: "Signature :",

    analysisSectionTitle: "Lecture & Analyse Statistique Approfondie",
    analysisSectionSubtitle: "Analyse pédagogique des données d'évaluation et orientation des activités de remédiation",

    defaultObservations: [
      "Tous les apprenants ont des difficultés avec le calcul de la limite.",
      "Tous les apprenants n’ont pas maîtrisé les propriétés de dérivation.",
      "Nombreux sont les élèves qui n’ont pas la possibilité de déterminer le domaine de définition d’une fonction numérique.",
      "Tous les apprenants ne sont pas capables de lire la courbe de la fonction.",
      "Tous les apprenants ont des grands problèmes avec les suites et les types de raisonnement."
    ],
    defaultPropositions: [
      "Rappeler les notions des limites, et des suites, intervenir des techniques sur la lecture de la courbe d’une fonction.",
      "Expliquer le principe de dérivation ( la majorité des élèves n’ont aucune idée sur la dérivation).",
      "Réaliser le soutien (exercices sur les limites, la dérivation, les suites et les fonctions) avec les apprenants en tant que solution d’intervention pour remédier, rattraper, corriger, et combler les lacunes.",
      "Intervenir même dans les séances des cours programmé pour la 2bac quelques minutes pour rattraper et corriger les fausses représentations."
    ],
    defaultExercises: [
      { titre: "Exercice 1", description: "Calcul numérique (calcul numérique, factorisation, identité remarquable)" },
      { titre: "Exercice 2", description: "Limité – Dérivabilité- Etude des fonctions – représentation graphique" },
      { titre: "Exercice 3", description: "Les suites numérique (suite arithmétique, suite géométrique…)" },
      { titre: "Exercice 4", description: "Notion de logique" }
    ]
  },

  ar: {
    appTitle: "برنامج التقويم التشخيصي",
    appEdition: "النسخة المغربية الرسمية",
    appSubtitle: "منظومة إعداد تقرير التقويم التشخيصي وفق مقتضيات المقرر الوزاري (المادة 08)",
    connectedToClassManagement: "متصل بإدارة الأقسام",
    demoModeBadge: "الوضع التجريبي (ثانية باك)",
    refreshBtn: "تحديث",
    toggleDemoBtn: "تبديل (تجريبي / حقيقي)",
    downloadExcelTemplateBtn: "نموذج إكسيل مسار",
    printPdfBtn: "طباعة التقرير",
    downloadPdfBtn: "تحميل التقرير (PDF)",
    downloadingPdfMsg: "جارٍ إنشاء وتحميل ملف PDF...",

    tabClasses: "1. الفصول والتلاميذ",
    tabNotes: "2. مسك النقط",
    tabStats: "3. الإحصائيات والفئات",
    tabObservations: "4. النتائج والمعالجة",
    tabConfig: "5. الإعدادات",
    tabPreview: "6. التقرير الرسمي (PDF)",

    scopeLabel: "نطاق التقرير :",
    scopeAllClasses: "جميع الفصول (تقرير شامل)",
    scopeSingleClass: "حسب القسم",
    scopeCustom: "تحديد مخصص",
    selectAllBtn: "تحديد الكل",
    deselectAllBtn: "إلغاء التحديد",
    selectedClassesCount: "فصل/فصول محددة",
    includeGraphsInReportLabel: "إدراج المبيانات والتحليل الإحصائي في التقرير الرسمي",
    includeGraphsDesc: "يضيف مخططات بيانية عمودية ودائرية وفقرة تحليل تربوي وإحصائي دقيقة في وثيقة التقرير.",

    classesHeaderTitle: "فصول المؤسسة وقوائم التلاميذ",
    classesHeaderSubtitle: "ترتبط هذه الفصول مباشرة بقاعات الدرس في إدارة الأقسام. النقط المدخلة هنا تُعتمد في حساب إحصائيات التقرير.",
    addClassBtn: "إضافة فصل جديد",
    classDateLabel: "تاريخ الإجراء :",
    totalStudentsLabel: "المسجلون",
    presentCountLabel: "الحاضرون / المقيمون",
    absentCountLabel: "الغائبون",
    averageNoteLabel: "المعدل العام",
    enterNotesBtn: "مسك النقط",
    importExcelBtn: "استيراد إكسيل",
    downloadClassTemplateBtn: "تحميل اللائحة",
    editClassBtn: "تعديل",
    deleteClassBtn: "حذف",
    noClassesMessage: "لم يتم العثور على فصول. أضف فصلاً أو قم بالمزامنة مع إدارة الأقسام.",

    selectClassLabel: "الفصل الحالي :",
    gradingModeLabel: "طريقة مسك النقط :",
    manualModeLabel: "مسك يدوي أو استيراد من ملف إكسيل",
    quizModeLabel: "استيراد النقط تلقائياً من اختبار (Quiz) على المنصة",
    selectQuizLabel: "اختر الاختبار :",
    syncQuizBtn: "استيراد ومزامنة نقط الاختبار",
    syncingQuizMsg: "جاري استيراد ومعالجة النقط...",
    quizModeDesc: "التلاميذ الذين اجتازوا هذا الاختبار سيحصلون على نقطتهم على 20 تلقائياً. التلاميذ الذين لم يجتازوا الاختبار سيُسجلون كغائبين (ABS).",
    importFromQuizBtn: "ربط باختبار (Quiz)",
    noQuizAvailableForClass: "لم يتم العثور على اختبار مرتبط بهذا الفصل. يمكنك اختيار اختبار عام أو إنشاء اختبار في قسم الامتحانات.",
    addStudentBtn: "إضافة تلميذ",
    saveNotesBtn: "حفظ النقط",
    numCol: "ر.ت",
    massarCol: "رمز مسار / المعرف",
    studentNameCol: "اسم التلميذ(ة)",
    noteCol: "النقطة / 20",
    trancheCol: "الفئة الرسمية",
    actionsCol: "الإجراءات",
    notGradedBadge: "غير منقط",
    absentBadge: "غائب (ABS)",
    setAbsBtn: "غياب",
    noStudentsMessage: "لا يوجد تلاميذ في هذا الفصل. أضف تلاميذ أو استورد لائحة إكسيل.",

    statsKpiTotalPresents: "مجموع التلاميذ الحاضرين",
    statsKpiStrugglingRate: "نسبة المتعثرين (≤8/20)",
    statsKpiAppreciation: "التقدير العام المستنتج",
    statsKpiClassesCount: "الفصول الخاضعة للتقويم",
    kpiSuccessRate: "نسبة التحكم والنجاح (≥10/20)",
    kpiAverageGrade: "المعدل العام للتقويم",
    chartDistributionTitle: "توزيع التلاميذ حسب الفصول والفئات الرسمية",
    chartDistributionSubtitle: "أعداد التلاميذ في كل فئة من الفئات الوزارية الأربع",
    chartColumnsTitle: "المخطط البياني بالأعمدة للفئات الأربع",
    chartPieTitle: "التوزيع النسبي الدائري للنتائج",
    officialTableTitle: "الجدول الإحصائي الرسمي (المطابق لتقرير التفتيش)",
    officialTableSubtitle: "عرض نظامي يوضح الأعداد والنسب المئوية المضبوطة بمجموع 100%",
    indicatorCol: "المؤشر",
    countRow: "العدد",
    percentageRow: "النسبة المئوية %",

    tranche1Name: "المتعثرون ] 8 – 0 ]",
    tranche2Name: "المسايرون ] 12 – 8 ]",
    tranche3Name: "المتفوقون ] 14 – 12 ]",
    tranche4Name: "المتميزون ] 20 – 14 ]",

    globalAppreciationTitle: "التقدير العام لنتائج التقويم التشخيصي",
    globalAppreciationSubtitle: "يُدرج هذا التقدير في مقدمة فقرة النتائج بالصفحة الثانية للتقرير الرسمي.",
    useCalculatedAppreciationBtn: "اعتماد القيمة المحسوبة تلقائياً",
    testCompositionTitle: "مكونات الروائز والاختبار",
    testCompositionSubtitle: "تحديد التمارين المكونة للرائز التشخيصي ومواضيعها (تظهر في الجدول الأول).",
    numExercisesLabel: "عدد التمارين (كتابة) :",
    addExerciseBtn: "إضافة تمرين",
    observationsTitle: "الملاحظات البيداغوجية المسجلة",
    observationsSubtitle: "تشخيص الصعوبات ومواطن التعثر المرصودة لدى المتعلمين (الصفحة 2).",
    addObservationBtn: "إضافة ملاحظة",
    propositionsTitle: "مقترحات الدعم والمعالجة والاستدراك",
    propositionsSubtitle: "الإجراءات والتدخلات المبرمجة لتجاوز الصعوبات ورأب الصدع (القسم 3).",
    addPropositionBtn: "إضافة مقترح دعم",

    adminConfigTitle: "المعطيات الإدارية والمؤسساتية",
    academieLabel: "الأكاديمية الجهوية :",
    directionLabel: "المديرية الإقليمية :",
    lyceeLabel: "المؤسسة / الثانوية :",
    anneeScolaireLabel: "السنة الدراسية :",
    pedagogicalConfigTitle: "المعطيات التربوية والأستاذ",
    teacherNameLabel: "اسم الأستاذ(ة) :",
    subjectLabel: "المادة :",
    gradeLevelLabel: "المستوى :",
    titleHeaderLabel: "المستوى في العنوان :",
    diagnosticPeriodLabel: "فترة التقويم التشخيصي :",
    section1ClassesLabel: "الفصول المعنية في القسم الأول :",
    resetDefaultsBtn: "استعادة القيم الافتراضية",
    saveConfigBtn: "حفظ الإعدادات",

    previewHeaderTitle: "معاينة التقرير الرسمي المعتمد (قياس A4)",
    previewHeaderSubtitle: "معاينة مطابقة للوثيقة المطبوعة بصيغة PDF. انقر على «طباعة» للتصدير.",
    backToEditBtn: "العودة للتحرير",
    printDocumentBtn: "طباعة التقرير",

    reportTitlePrefix: "تقرير التقويم التشخيصي –",
    reportTeacherPrefix: "الأستاذ(ة) :",
    reportSubjectPrefix: "المادة :",
    reportLevelPrefix: "المستوى :",
    reportObjectivesTitle: "أهداف التقويم التشخيصي :",
    reportSection1Title: "I. معلومات عامة حول التقويم التشخيصي",
    reportSection1Intro: "يلخص الجدول التالي برمجة وتوقيت إجراء التقويم التشخيصي وعدد المتعلمين الحاضرين :",
    reportSection2Title: "II. تحليل نتائج التقويم التشخيصي",
    reportTable1ClassCol: "الفصل / القسم",
    reportTable1DateCol: "تاريخ الإجراء",
    reportTable1PresentsCol: "عدد المتعلمين الحاضرين",
    reportTable1TotalRow: "المجموع",
    reportCompositionPrefix: "- مكونات الاختبار : تقويم يتكون من",
    reportResultsTitle: "النتائج والملاحظات :",
    reportResultsIntroPrefix: "بعد اجتياز المتعلمين لهذا الرائز التشخيصي، يُسجل أن النتائج المحصل عليها جاءت",
    reportSection3Title: "➢ III. مقترحات الدعم والمعالجة :",
    reportSection3Intro: "لتجاوز هذه التعثرات والصعوبات المرصودة، يُقترح ما يلي :",
    reportSignatureTitle: "توقيع الأستاذ(ة) :",

    analysisSectionTitle: "قراءة إحصائية وتربوية معززة للنتائج",
    analysisSectionSubtitle: "تحليل معمق لمعطيات التقويم التشخيصي وتوجيه خطة الدعم التربوي",

    defaultObservations: [
      "صعوبات ملحوظة في حساب النهايات ومفهوم الاتصال.",
      "عدم التمكن الكافي من خاصيات وقواعد الاشتقاق وتطبيقاتها.",
      "عجز عدد كبير من المتعلمين عن تحديد مجموعة تعريف الدوال العددية بدقة.",
      "صعوبة في قراءة واستثمار المنحنيات الممثلة للدوال وجداول التغيرات.",
      "تعثرات واضحة في دراسة المتتاليات العددية وأنماط الاستدلال الرياضي."
    ],
    defaultPropositions: [
      "تقديم تذكير مركز بالمفاهيم الأساسية للنهايات والاشتقاق والمتتاليات.",
      "شرح وتوضيح مبادئ الحساب التفاضلي وقواعد الاشتقاق وتطبيقاتها المباشرة.",
      "برمجة وإنجاز حصص دعم واستدراك مستهدفة لعلاج الثغرات المرصودة وتثبيت المكتسبات.",
      "تخصيص دقائق تمهيدية منتظمة خلال حصص المقرر لمعالجة التمثلات الخاطئة لدى التلاميذ.",
      "توفير بطاقات تمارين داعمة متدرجة الصعوبة تراعي الفوارق الفردية للمتعلمين."
    ],
    defaultExercises: [
      { titre: "التمرين 1", description: "الحساب العددي (التعميل، الحساب الجبري، المتطابقات الهامة)" },
      { titre: "التمرين 2", description: "النهايات – الاشتقاق – دراسة الدوال والتمثيل المبياني" },
      { titre: "التمرين 3", description: "المتتاليات العددية (الحسابية والهندسية)" },
      { titre: "التمرين 4", description: "مبادئ في المنطق الرياضي والاستدلال" }
    ]
  },

  en: {
    appTitle: "DiagEval Pro",
    appEdition: "Morocco Official Edition",
    appSubtitle: "Diagnostic Evaluation Platform compliant with Ministerial Decision (Article 08) & Official Reports",
    connectedToClassManagement: "Connected to Class Management",
    demoModeBadge: "Demo Mode (Baccalaureate)",
    refreshBtn: "Refresh",
    toggleDemoBtn: "Toggle Demo/Live",
    downloadExcelTemplateBtn: "Massar Excel Template",
    printPdfBtn: "Print Report",
    downloadPdfBtn: "Download Report (PDF)",
    downloadingPdfMsg: "Generating and downloading PDF...",

    tabClasses: "1. Classes & Students",
    tabNotes: "2. Grade Entry",
    tabStats: "3. Statistics & Tiers",
    tabObservations: "4. Results & Remediation",
    tabConfig: "5. Settings",
    tabPreview: "6. Official Report (PDF)",

    scopeLabel: "Report Scope:",
    scopeAllClasses: "All classes (Total Report)",
    scopeSingleClass: "Per class",
    scopeCustom: "Custom Selection",
    selectAllBtn: "Select All",
    deselectAllBtn: "Deselect All",
    selectedClassesCount: "class(es) selected",
    includeGraphsInReportLabel: "Include charts & pedagogical statistical analysis in the report",
    includeGraphsDesc: "Appends column & pie charts and an analytical commentary directly to the printed document.",

    classesHeaderTitle: "School Classes & Student Rosters",
    classesHeaderSubtitle: "These classes synchronize directly with your Class Management rooms. Grades entered here populate the official inspection report.",
    addClassBtn: "Add New Class",
    classDateLabel: "Assessment Date:",
    totalStudentsLabel: "Enrolled",
    presentCountLabel: "Present / Evaluated",
    absentCountLabel: "Absent",
    averageNoteLabel: "Diagnostic Average",
    enterNotesBtn: "Enter Grades",
    importExcelBtn: "Import Excel",
    downloadClassTemplateBtn: "Excel Roster",
    editClassBtn: "Edit",
    deleteClassBtn: "Remove",
    noClassesMessage: "No classes found. Add a class or synchronize from Class Management.",

    selectClassLabel: "Current Class:",
    gradingModeLabel: "Grading Source Mode:",
    manualModeLabel: "Manual Entry & Excel Template",
    quizModeLabel: "Import from Platform Quiz",
    selectQuizLabel: "Select Quiz:",
    syncQuizBtn: "Sync Quiz Grades",
    syncingQuizMsg: "Fetching quiz submissions...",
    quizModeDesc: "Students who completed this quiz will automatically receive their grade out of 20. Students with no submissions will be marked as ABS (Absent).",
    importFromQuizBtn: "Link to Quiz",
    noQuizAvailableForClass: "No quizzes found for this class. You can select another quiz or create one in the Exams section.",
    addStudentBtn: "Add Student",
    saveNotesBtn: "Save Grades",
    numCol: "#",
    massarCol: "Massar Code / ID",
    studentNameCol: "Student Full Name",
    noteCol: "Grade / 20",
    trancheCol: "Official Tier",
    actionsCol: "Actions",
    notGradedBadge: "Not graded",
    absentBadge: "Absent (ABS)",
    setAbsBtn: "ABS",
    noStudentsMessage: "No students in this class. Add students manually or import an Excel file.",

    statsKpiTotalPresents: "Total Assessed Students",
    statsKpiStrugglingRate: "Struggling Students Rate (≤8/20)",
    statsKpiAppreciation: "Deduced Global Assessment",
    statsKpiClassesCount: "Assessed Classes",
    kpiSuccessRate: "Mastery Rate (≥10/20)",
    kpiAverageGrade: "Cohort Average",
    chartDistributionTitle: "Distribution by Class and Official Tier",
    chartDistributionSubtitle: "Number of learners across each of the 4 ministerial tiers",
    chartColumnsTitle: "4-Tier Column Bar Chart",
    chartPieTitle: "Overall Assessment Distribution",
    officialTableTitle: "Official Assessment Results Table (Inspection Compliant)",
    officialTableSubtitle: "Regulatory presentation showing student counts and percentage totals adjusted to 100%",
    indicatorCol: "Indicator",
    countRow: "Count",
    percentageRow: "Percentage %",

    tranche1Name: "Struggling [0 – 8]",
    tranche2Name: "Progressing [8 – 12]",
    tranche3Name: "Proficient [12 – 14]",
    tranche4Name: "Exemplary [14 – 20]",

    globalAppreciationTitle: "Overall Diagnostic Appreciation",
    globalAppreciationSubtitle: "This assessment appears in the introductory results paragraph on Page 2 of the official report.",
    useCalculatedAppreciationBtn: "Use Calculated Value",
    testCompositionTitle: "Assessment Test Composition",
    testCompositionSubtitle: "Detail the exercises comprising the diagnostic test (displayed in Section I Table).",
    numExercisesLabel: "Number of exercises (in words):",
    addExerciseBtn: "Add Exercise",
    observationsTitle: "Observed Pedagogical Findings",
    observationsSubtitle: "Diagnostic findings highlighting learner difficulties and strengths (Page 2).",
    addObservationBtn: "Add Observation",
    propositionsTitle: "Remediation & Support Proposals",
    propositionsSubtitle: "Planned instructional interventions to address identified learning gaps (Section III).",
    addPropositionBtn: "Add Proposal",

    adminConfigTitle: "Administrative & Institutional Information",
    academieLabel: "Regional Academy:",
    directionLabel: "Provincial Directorate:",
    lyceeLabel: "High School / Institution:",
    anneeScolaireLabel: "Academic Year:",
    pedagogicalConfigTitle: "Teacher & Curriculum Information",
    teacherNameLabel: "Teacher Name (Pr):",
    subjectLabel: "Subject:",
    gradeLevelLabel: "Grade Level:",
    titleHeaderLabel: "Title Heading:",
    diagnosticPeriodLabel: "Diagnostic Period:",
    section1ClassesLabel: "Classes Mentioned in Section 1:",
    resetDefaultsBtn: "Reset to Defaults",
    saveConfigBtn: "Save Settings",

    previewHeaderTitle: "Official Report Preview (A4 Format)",
    previewHeaderSubtitle: "Preview the report exactly as it will print or export to PDF. Click 'Print' to export.",
    backToEditBtn: "Back to Editing",
    printDocumentBtn: "Print Report",

    reportTitlePrefix: "Diagnostic Evaluation Report –",
    reportTeacherPrefix: "Teacher:",
    reportSubjectPrefix: "Subject:",
    reportLevelPrefix: "Level:",
    reportObjectivesTitle: "Diagnostic Assessment Objectives:",
    reportSection1Title: "I. General Diagnostic Assessment Information",
    reportSection1Intro: "The following table summarizes the scheduling of the diagnostic assessment and the number of attending students:",
    reportSection2Title: "II. Diagnostic Assessment Results Analysis",
    reportTable1ClassCol: "Class",
    reportTable1DateCol: "Assessment Date",
    reportTable1PresentsCol: "Attending Students Count",
    reportTable1TotalRow: "Total",
    reportCompositionPrefix: "- Test Composition: an assessment consisting of",
    reportResultsTitle: "Results:",
    reportResultsIntroPrefix: "Following the administration of this test, the recorded results are assessed as",
    reportSection3Title: "➢ III. Support & Remediation Proposals:",
    reportSection3Intro: "To overcome the identified obstacles, the following measures are proposed:",
    reportSignatureTitle: "Teacher Signature:",

    analysisSectionTitle: "In-Depth Statistical & Pedagogical Analysis",
    analysisSectionSubtitle: "Comprehensive evaluation data interpretation and targeted remediation roadmap",

    defaultObservations: [
      "Noticeable difficulties in limits calculation and continuity concepts.",
      "Insufficient mastery of differentiation rules and their graphical applications.",
      "Significant number of students unable to accurately determine the domain of definition of a function.",
      "Difficulties interpreting function curves, asymptotes, and variation tables.",
      "Prominent obstacles with numerical sequences and mathematical reasoning methods."
    ],
    defaultPropositions: [
      "Conduct focused review sessions on foundational limits, derivatives, and sequences.",
      "Clarify differentiation principles and step-by-step calculus rules.",
      "Implement targeted remedial workshops to bridge identified gaps and reinforce prerequisites.",
      "Allocate preliminary minutes at the beginning of lessons to address false conceptions.",
      "Provide differentiated support worksheets tailored to varying proficiency levels."
    ],
    defaultExercises: [
      { titre: "Exercise 1", description: "Numerical calculation (factorization, algebraic manipulation, identities)" },
      { titre: "Exercise 2", description: "Limits – Differentiability – Function study & curve sketching" },
      { titre: "Exercise 3", description: "Numerical sequences (arithmetic and geometric sequences)" },
      { titre: "Exercise 4", description: "Mathematical logic & proof techniques" }
    ]
  }
};

/**
 * Traduction dynamique des appréciations qualitatives selon la langue
 */
export function translateAppreciation(appr: string, lang: DiagLang): string {
  if (!appr) return "";
  const clean = appr.toLowerCase().trim();

  if (lang === "ar") {
    if (clean.includes("très satisfaisant") || clean.includes("tres satisfaisant")) return "مرضية ومتميزة جداً";
    if (clean.includes("satisfaisant")) return "مرضية ومشجعة";
    if (clean.includes("moyen") || clean.includes("difficulté") || clean.includes("difficulte")) return "متوسطة مع تسجيل تعثرات نوعية";
    if (clean.includes("médiocre") || clean.includes("mediocre")) return "متعثرة وتستدعي المعالجة الفورية";
    if (clean.includes("faible")) return "دون المستوى المطلوب وبحاجة لدعم مكثف";
    return appr;
  }

  if (lang === "en") {
    if (clean.includes("très satisfaisant") || clean.includes("tres satisfaisant")) return "highly satisfactory";
    if (clean.includes("satisfaisant")) return "satisfactory";
    if (clean.includes("moyen") || clean.includes("difficulté") || clean.includes("difficulte")) return "average with targeted difficulties";
    if (clean.includes("médiocre") || clean.includes("mediocre")) return "mediocre with substantial learning gaps";
    if (clean.includes("faible")) return "low and requiring intensive remedial support";
    return appr;
  }

  // French
  return appr;
}

/**
 * Générateur intelligent de commentaire statistique et pédagogique approfondi
 */
export function generateStatisticalCommentary(
  stats: GlobalDiagnosticStats,
  lang: DiagLang,
  classNames: string[]
): {
  executiveSummary: string;
  tierBreakdown: string;
  pedagogicalRoadmap: string;
} {
  const presents = parseInt(stats.total_presents || "0", 10);
  const classesText = classNames.length > 0 ? classNames.join(", ") : "l'ensemble des classes";
  const localizedAppr = translateAppreciation(stats.default_appreciation, lang);

  // Calcul des totaux par tranche
  const totalT1 = stats.classes_stats.reduce((acc, s) => acc + s.t1_count, 0);
  const totalT2 = stats.classes_stats.reduce((acc, s) => acc + s.t2_count, 0);
  const totalT3 = stats.classes_stats.reduce((acc, s) => acc + s.t3_count, 0);
  const totalT4 = stats.classes_stats.reduce((acc, s) => acc + s.t4_count, 0);

  const pctT1 = presents > 0 ? Math.round((totalT1 / presents) * 100) : 0;
  const pctT2 = presents > 0 ? Math.round((totalT2 / presents) * 100) : 0;
  const pctT3 = presents > 0 ? Math.round((totalT3 / presents) * 100) : 0;
  const pctT4 = presents > 0 ? Math.round((totalT4 / presents) * 100) : 0;

  const validAvgList = stats.classes_stats.map(s => s.average_note).filter(n => n > 0);
  const overallAvg = validAvgList.length > 0
    ? (validAvgList.reduce((a, b) => a + b, 0) / validAvgList.length).toFixed(2)
    : "0.00";

  if (lang === "ar") {
    return {
      executiveSummary: `شمل هذا التقويم التشخيصي الخاص بـ (${classesText}) ما مجموعه ${presents} متعلماً ومتعلمة بمعدل عام بلغ ${overallAvg} من 20. تعكس النتائج تقديراً إجمالياً يُصنف ضمن النتائج «${localizedAppr}»، حيث تظهر المعطيات تمايزاً واضحاً في مستوى جاهزية التلاميذ واستيعابهم للمفاهيم الأساسية المقررة في المستويات السابقة.`,
      tierBreakdown: `توزيع المتعلمين حسب الفئات المعيارية المعتمدة رسمياً يُظهر أن نسبة فئة «المتميزون» (النقط بين 14 و20) بلغت ${pctT4}% (${totalT4} تلميذاً)، في حين استقرت نسبة فئة «المتفوقون» (النقط بين 12 و14) عند ${pctT3}% (${totalT3} تلميذاً)، وفئة «المسايرون» (النقط بين 8 و12) بنسبة ${pctT2}% (${totalT2} تلميذاً). بالمقابل، سُجلت نسبة ${pctT1}% (${totalT1} تلميذاً) ضمن فئة «المتعثرون» التي نالت نقطاً لا تتعدى 8 من 20.`,
      pedagogicalRoadmap: `بناءً على هذا التشخيص الميداني، يتعين تركيز خطة المعالجة الآنية على تدارك التعثرات المرصودة لدى الفئة المتعثرة عبر حصص الدعم المندمج والمؤسساتي، مع اعتماد بيداغوجيا فارقية تراعي الفروق الفردية خلال الأسابيع الأولى من إرساء الموارد الجديدة، لضمان تكافؤ الفرص ورفع مردودية التحصيل الدراسي.`
    };
  }

  if (lang === "en") {
    return {
      executiveSummary: `The diagnostic evaluation conducted across (${classesText}) encompassed ${presents} attending students, yielding an overall average grade of ${overallAvg} out of 20. The findings correspond to a qualitative appraisal classified as "${localizedAppr}", underscoring noticeable disparities in prerequisite mastery among the student body.`,
      tierBreakdown: `The distribution across the four regulatory proficiency tiers indicates that ${pctT4}% of students (${totalT4} learners) achieved the "Exemplary" tier (14–20/20), while ${pctT3}% (${totalT3} learners) placed in the "Proficient" tier (12–14/20), and ${pctT2}% (${totalT2} learners) in the "Progressing" tier (8–12/20). Notably, ${pctT1}% (${totalT1} learners) fall into the "Struggling" tier (≤8/20), reflecting significant prerequisite deficits.`,
      pedagogicalRoadmap: `In accordance with these diagnostic insights, instructional priorities must center on targeted remediation protocols for struggling learners. Introducing structured formative reinforcement, scaffolded review exercises, and differentiated instruction during the initial curricular modules will be instrumental in bridging foundational learning gaps.`
    };
  }

  // Français par défaut
  return {
    executiveSummary: `L'évaluation diagnostique menée pour (${classesText}) a mobilisé un effectif total de ${presents} apprenants présents, aboutissant à une moyenne générale de ${overallAvg} sur 20. L'appréciation d'ensemble déduite est qualifiée de « ${localizedAppr} », révélant une hétérogénéité marquée dans l'assimilation des prérequis indispensables.`,
    tierBreakdown: `La ventilation statistique selon les 4 tranches officielles établit que ${pctT4}% des apprenants (${totalT4} élèves) se hissent dans la tranche « Excellence » (14–20/20), ${pctT3}% (${totalT3} élèves) dans la tranche « Maîtrise satisfaisante » (12–14/20), et ${pctT2}% (${totalT2} élèves) dans la tranche « En progression » (8–12/20). La tranche « En difficulté » (≤8/20) regroupe quant à elle ${pctT1}% de l'effectif (${totalT1} élèves), caractérisée par des lacunes conceptuelles substantielles.`,
    pedagogicalRoadmap: `À la lumière de ce diagnostic quantitatif et qualitatif, le plan d'action pédagogique consistera à déployer des activités de soutien ciblé et de remédiation immédiate pour les apprenants en difficulté, tout en pratiquant une pédagogie différenciée dès les premières séquences d'apprentissage afin de sécuriser l'acquisition des nouvelles compétences du programme.`
  };
}
