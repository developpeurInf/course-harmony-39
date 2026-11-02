import { Box, Calculator, Dices, Infinity as InfinityIcon, LineChart, Shapes, Sigma, type LucideIcon } from "lucide-react";
import type { Tr } from "@/components/office/shared/useOfficeEnv";

/** Applications GeoGebra proposées (paramètre « appName » de l'API GeoGebra Apps) */
export type GgbAppId = "graphing" | "geometry" | "3d" | "cas" | "probability" | "scientific" | "classic";

export interface GgbAppDef {
  id: GgbAppId;
  /** appName passé à GGBApplet */
  appName: "graphing" | "geometry" | "3d" | "cas" | "scientific" | "classic";
  /** perspective de départ (GeoGebra Classic) */
  perspective?: string;
  icon: LucideIcon;
  color: string;
  label: (L: Tr) => string;
  desc: (L: Tr) => string;
}

export const GGB_APPS: GgbAppDef[] = [
  {
    id: "graphing", appName: "graphing", icon: LineChart, color: "#6557D2",
    label: (L) => L("Calculatrice graphique", "الآلة الحاسبة البيانية", "Graphing calculator"),
    desc: (L) => L("Tracer des fonctions, des courbes, des inéquations, trouver racines et extremums, curseurs.", "رسم الدوال والمنحنيات والمتراجحات وإيجاد الجذور والقيم القصوى والمنزلقات.", "Plot functions, curves and inequalities, find roots and extrema, sliders."),
  },
  {
    id: "geometry", appName: "geometry", icon: Shapes, color: "#00A8A8",
    label: (L) => L("Géométrie", "الهندسة", "Geometry"),
    desc: (L) => L("Constructions à la règle et au compas, cercles, angles, transformations, lieux.", "إنشاءات بالمسطرة والبركار ودوائر وزوايا وتحويلات ومحلات هندسية.", "Ruler-and-compass constructions, circles, angles, transformations, loci."),
  },
  {
    id: "3d", appName: "3d", icon: Box, color: "#E5682B",
    label: (L) => L("Graphique 3D", "الرسم ثلاثي الأبعاد", "3D calculator"),
    desc: (L) => L("Surfaces, solides, plans et droites dans l'espace, patrons, rotation à la souris.", "السطوح والمجسمات والمستويات والمستقيمات في الفضاء والنشور والتدوير.", "Surfaces, solids, planes and lines in space, nets, rotate with the mouse."),
  },
  {
    id: "cas", appName: "cas", icon: Sigma, color: "#C2185B",
    label: (L) => L("Calcul formel (CAS)", "الحساب الرمزي (CAS)", "CAS calculator"),
    desc: (L) => L("Développer, factoriser, résoudre, dériver, intégrer, limites, avec le graphique à côté.", "النشر والتعميل والحل والاشتقاق والتكامل والنهايات مع المبيان.", "Expand, factor, solve, differentiate, integrate, limits, with the graph alongside."),
  },
  {
    id: "probability", appName: "classic", perspective: "B", icon: Dices, color: "#2E7D32",
    label: (L) => L("Probabilités", "الاحتمالات", "Probability"),
    desc: (L) => L("Lois binomiale, normale, de Poisson… calcul de probabilités et graphiques.", "قوانين ثنائية الحد والطبيعي وبواسون… حساب الاحتمالات والمبيانات.", "Binomial, normal, Poisson distributions… probabilities and charts."),
  },
  {
    id: "scientific", appName: "scientific", icon: Calculator, color: "#455A64",
    label: (L) => L("Calculatrice scientifique", "الآلة الحاسبة العلمية", "Scientific calculator"),
    desc: (L) => L("Calculs, fractions, puissances, trigonométrie, statistiques simples.", "العمليات والكسور والقوى والمثلثات والإحصاء البسيط.", "Arithmetic, fractions, powers, trigonometry, basic statistics."),
  },
  {
    id: "classic", appName: "classic", icon: InfinityIcon, color: "#1565C0",
    label: (L) => L("GeoGebra Classique", "جيوجبرا الكلاسيكي", "GeoGebra Classic"),
    desc: (L) => L("Toutes les vues : algèbre, graphique 2D et 3D, tableur, CAS, probabilités, menu complet.", "كل النوافذ: الجبر والرسم ثنائي وثلاثي الأبعاد والجدول وCAS والاحتمالات.", "Every view: algebra, 2D and 3D graphics, spreadsheet, CAS, probability, full menu."),
  },
];

export const ggbApp = (id: string | undefined): GgbAppDef | undefined => GGB_APPS.find((a) => a.id === id);
