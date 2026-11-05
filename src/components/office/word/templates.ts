/** Modèles de documents Word */
import type { Tr } from "../shared/useOfficeEnv";
import { defaultPage, type PageSettings } from "./pageSettings";

export function wordTemplates(L: Tr) {
  return [
    { id: "blank", label: L("Document vierge", "مستند فارغ", "Blank document") },
    { id: "lesson", label: L("Fiche de cours", "ملخص درس", "Lesson sheet"), desc: L("Titre, objectifs, définitions, exemples", "العنوان والأهداف والتعاريف والأمثلة", "Title, goals, definitions, examples") },
    { id: "exam", label: L("Devoir surveillé", "فرض محروس", "Exam paper"), desc: L("En-tête, barème, exercices", "الرأسية والتنقيط والتمارين", "Header, marks, exercises") },
    { id: "report", label: L("Rapport", "تقرير", "Report"), desc: L("Page de garde et sommaire", "صفحة الغلاف والفهرس", "Cover page and contents") },
    { id: "letter", label: L("Lettre", "رسالة", "Letter"), desc: L("Lettre administrative", "رسالة إدارية", "Formal letter") },
    { id: "cv", label: L("CV", "سيرة ذاتية", "Résumé") },
  ];
}

export function buildWordTemplate(id: string, L: Tr, isRtl: boolean): { html: string; page: PageSettings } {
  const page = defaultPage();
  const d = isRtl ? ' dir="rtl"' : "";
  const today = new Date().toLocaleDateString(isRtl ? "ar-MA" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });
  switch (id) {
    case "lesson":
      page.header = L("Mathématiques — Tronc commun", "الرياضيات — الجذع المشترك", "Mathematics");
      page.pageNumbers = "footer";
      return {
        page,
        html: `<h1 style="text-align:center"${d}>${L("Les fonctions numériques", "الدوال العددية", "Numerical functions")}</h1>
<p style="text-align:center"${d}><em>${L("Professeur", "الأستاذ", "Teacher")} : …… · ${today}</em></p>
<h2${d}>${L("Objectifs", "الأهداف", "Goals")}</h2>
<ul><li><p${d}>${L("Déterminer l'ensemble de définition d'une fonction.", "تحديد مجموعة تعريف دالة.", "Find the domain of a function.")}</p></li><li><p${d}>${L("Étudier les variations d'une fonction.", "دراسة تغيرات دالة.", "Study the variations of a function.")}</p></li></ul>
<h2${d}>1. ${L("Définition", "تعريف", "Definition")}</h2>
<p data-shading="#DCE6F4" style="background-color:#DCE6F4"${d}><strong>${L("Définition", "تعريف", "Definition")} :</strong> ${L("Une fonction f associe à chaque réel x de D au plus un réel noté f(x).", "الدالة f تربط كل عدد حقيقي x من D بعدد حقيقي واحد على الأكثر نرمز له ب f(x).", "A function f maps each real x in D to at most one real f(x).")}</p>
<h2${d}>2. ${L("Exemple", "مثال", "Example")}</h2>
<p${d}>${L("Soit", "لتكن", "Let")} <span data-latex="f(x) = \\frac{2x+1}{x-3}"></span> ${L(", alors", "، إذن", ", then")} <span data-latex="D_f = \\mathbb{R} \\setminus \\{3\\}"></span>.</p>
<h2${d}>3. ${L("Exercice d'application", "تمرين تطبيقي", "Practice")}</h2>
<ol><li><p${d}>${L("Déterminer D_f pour", "حدد D_f بالنسبة ل", "Find D_f for")} <span data-latex="f(x)=\\sqrt{x-2}"></span>.</p></li><li><p${d}>${L("Calculer f(6).", "احسب f(6).", "Compute f(6).")}</p></li></ol>`,
      };
    case "exam":
      page.pageNumbers = "footer";
      page.margins = { top: 15, right: 18, bottom: 15, left: 18 };
      return {
        page,
        html: `<table data-style="plain"><tbody><tr><td><p${d}><strong>${L("Établissement", "المؤسسة", "School")} :</strong> ……</p><p${d}><strong>${L("Classe", "القسم", "Class")} :</strong> ……</p></td><td><p style="text-align:center"${d}><strong>${L("Devoir surveillé n° 1", "الفرض المحروس رقم 1", "Test No. 1")}</strong></p><p style="text-align:center"${d}>${L("Durée : 1 h", "المدة: ساعة واحدة", "Time: 1 h")}</p></td><td><p${d}><strong>${L("Nom", "الاسم", "Name")} :</strong> ……</p><p${d}><strong>${L("Note", "النقطة", "Mark")} :</strong> ……/20</p></td></tr></tbody></table>
<h2${d}>${L("Exercice 1", "التمرين 1", "Exercise 1")} (6 pts)</h2>
<ol><li><p${d}>${L("Résoudre dans ℝ l'équation", "حل في ℝ المعادلة", "Solve in ℝ")} <span data-latex="2x^2 - 5x + 2 = 0"></span>.</p></li><li><p${d}>${L("En déduire le signe de", "استنتج إشارة", "Deduce the sign of")} <span data-latex="2x^2 - 5x + 2"></span>.</p></li></ol>
<h2${d}>${L("Exercice 2", "التمرين 2", "Exercise 2")} (8 pts)</h2>
<p${d}>${L("Soit ABC un triangle rectangle en A tel que AB = 3 cm et AC = 4 cm.", "ليكن ABC مثلثا قائم الزاوية في A بحيث AB = 3 cm و AC = 4 cm.", "Let ABC be a right triangle at A with AB = 3 cm and AC = 4 cm.")}</p>
<ol><li><p${d}>${L("Calculer BC.", "احسب BC.", "Compute BC.")}</p></li><li><p${d}>${L("Calculer", "احسب", "Compute")} <span data-latex="\\cos(\\widehat{ABC})"></span>.</p></li></ol>
<h2${d}>${L("Exercice 3", "التمرين 3", "Exercise 3")} (6 pts)</h2>
<p${d}>……</p>
<p style="text-align:center"${d}><em>${L("Bon courage !", "بالتوفيق!", "Good luck!")}</em></p>`,
      };
    case "report":
      page.pageNumbers = "footer";
      return {
        page,
        html: `<p style="margin-top:180px;text-align:center"${d}><span style="font-size:32pt;color:#2B579A">${L("Titre du rapport", "عنوان التقرير", "Report title")}</span></p>
<p style="text-align:center"${d}><span style="font-size:16pt;color:#595959">${L("Sous-titre du rapport", "العنوان الفرعي", "Subtitle")}</span></p>
<p style="margin-top:220px;text-align:center"${d}>${L("Auteur", "المؤلف", "Author")} · ${today}</p>
<div data-page-break="1"></div>
<div data-toc="1" data-title="${L("Table des matières", "الفهرس", "Contents")}"></div>
<div data-page-break="1"></div>
<h1${d}>1. ${L("Introduction", "مقدمة", "Introduction")}</h1>
<p${d}>${L("Présentez ici le contexte et les objectifs du rapport.", "قدّم هنا السياق وأهداف التقرير.", "Present the context and goals here.")}</p>
<h1${d}>2. ${L("Analyse", "التحليل", "Analysis")}</h1>
<h2${d}>2.1 ${L("Résultats", "النتائج", "Results")}</h2>
<p${d}>${L("Décrivez les résultats obtenus.", "صف النتائج المحصل عليها.", "Describe the results.")}</p>
<h1${d}>3. ${L("Conclusion", "خاتمة", "Conclusion")}</h1>
<p${d}>…</p>`,
      };
    case "letter":
      return {
        page,
        html: `<p${d}><strong>${L("Prénom NOM", "الاسم الكامل", "Full name")}</strong><br>${L("Adresse", "العنوان", "Address")}<br>${L("Téléphone · e-mail", "الهاتف · البريد الإلكتروني", "Phone · email")}</p>
<p style="text-align:${isRtl ? "left" : "right"}"${d}>${L("À", "إلى", "To")} ……, ${L("le", "في", "on")} ${today}</p>
<p style="text-align:${isRtl ? "left" : "right"}"${d}>${L("Monsieur le Directeur", "السيد المدير", "Dear Director")}<br>……</p>
<p${d}><strong>${L("Objet", "الموضوع", "Subject")} :</strong> ……</p>
<p${d}>${L("Monsieur le Directeur,", "السيد المدير،", "Dear Sir or Madam,")}</p>
<p style="text-indent:36px;text-align:justify"${d}>${L("J'ai l'honneur de …", "يشرفني أن …", "I am writing to …")}</p>
<p style="text-indent:36px;text-align:justify"${d}>${L("Je vous prie d'agréer, Monsieur le Directeur, l'expression de mes salutations distinguées.", "وتقبلوا، السيد المدير، فائق التقدير والاحترام.", "Yours faithfully,")}</p>
<p style="margin-top:36px;text-align:${isRtl ? "left" : "right"}"${d}>${L("Signature", "التوقيع", "Signature")}</p>`,
      };
    case "cv":
      page.margins = { top: 15, right: 15, bottom: 15, left: 15 };
      page.theme = "modern";
      return {
        page,
        html: `<h1${d}><span style="font-size:28pt">${L("Prénom NOM", "الاسم الكامل", "Full name")}</span></h1>
<p${d}><span style="color:#0F766E">${L("Professeur de mathématiques", "أستاذ الرياضيات", "Mathematics teacher")}</span> · ${L("Ville", "المدينة", "City")} · email@exemple.com · 06 00 00 00 00</p>
<hr>
<h2${d}>${L("Profil", "نبذة", "Profile")}</h2>
<p${d}>${L("Quelques lignes pour vous présenter.", "بضعة أسطر للتعريف بنفسك.", "A few lines about you.")}</p>
<h2${d}>${L("Expérience", "الخبرة", "Experience")}</h2>
<p${d}><strong>2020 – ${L("aujourd'hui", "الآن", "today")}</strong> · ${L("Lycée …", "ثانوية …", "High school …")}</p>
<ul><li><p${d}>…</p></li></ul>
<h2${d}>${L("Formation", "التكوين", "Education")}</h2>
<p${d}><strong>2019</strong> · ${L("Master …", "ماستر …", "Master …")}</p>
<h2${d}>${L("Compétences", "الكفاءات", "Skills")}</h2>
<table data-style="plain"><tbody><tr><td><p${d}>${L("Pédagogie", "البيداغوجيا", "Teaching")}</p></td><td><p${d}>★★★★★</p></td></tr><tr><td><p${d}>${L("Outils numériques", "الأدوات الرقمية", "Digital tools")}</p></td><td><p${d}>★★★★☆</p></td></tr></tbody></table>`,
      };
    default:
      return { page, html: `<p${d}></p>` };
  }
}
