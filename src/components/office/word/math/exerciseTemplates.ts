/**
 * Modèles d'énoncés pour les profs de maths : en-tête de devoir, exercice numéroté
 * avec barème, QCM, vrai / faux, problème en parties, encadrés de cours.
 * Les numéros d'exercice suivent ceux déjà présents dans le document.
 */
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Tr } from "../../shared/useOfficeEnv";

const t = (text: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text, ...(marks ? { marks } : {}) });
const b = (text: string) => t(text, [{ type: "bold" }]);
const p = (content: JSONContent[] = [], attrs?: Record<string, unknown>): JSONContent => ({ type: "paragraph", ...(attrs ? { attrs } : {}), content });
const h = (level: number, content: JSONContent[]): JSONContent => ({ type: "heading", attrs: { level }, content });
const math = (latex: string, display = false): JSONContent => ({ type: "mathInline", attrs: { latex, display } });
const li = (content: JSONContent[], sub?: JSONContent): JSONContent => ({ type: "listItem", content: [p(content), ...(sub ? [sub] : [])] });
const ol = (items: JSONContent[], type?: string): JSONContent => ({ type: "orderedList", attrs: { start: 1, ...(type ? { type } : {}) }, content: items });
const cell = (content: JSONContent[], header = false): JSONContent => ({ type: header ? "tableHeader" : "tableCell", content: [p(content)] });
const row = (cells: JSONContent[]): JSONContent => ({ type: "tableRow", content: cells });
const table = (rows: JSONContent[]): JSONContent => ({ type: "table", content: rows });

/** « Exercice 3 », « Exercise 3 », « التمرين 3 » en début de titre ou de paragraphe */
export const EXO_RE = /^\s*(exercice|exercise|التمرين|تمرين)\s*(n°\s*)?(\d+)/i;
const POINTS_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*(points?|pts?|ن|نقط|نقطة)\s*\)/i;

export function nextExerciseNumber(editor: Editor | null): number {
  let n = 0;
  editor?.state.doc.descendants((node) => {
    if (node.isTextblock) {
      const m = EXO_RE.exec(node.textContent);
      if (m) n = Math.max(n, Number(m[3]));
      return false;
    }
    return true;
  });
  return n + 1;
}

/** Renumérote les exercices dans l'ordre et calcule le barème total */
export function renumberExercises(editor: Editor): { count: number; total: number } {
  const { tr, schema } = editor.state;
  const found: { from: number; to: number; num: string; marks: readonly import("@tiptap/pm/model").Mark[] }[] = [];
  let total = 0;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textContent;
    const m = EXO_RE.exec(text);
    if (m) {
      // position du numéro dans le premier nœud texte
      const first = node.firstChild;
      if (first?.isText) {
        const idx = (first.text || "").search(/\d+/);
        const mm = /\d+/.exec(first.text || "");
        if (idx >= 0 && mm && idx <= m[0].length) found.push({ from: pos + 1 + idx, to: pos + 1 + idx + mm[0].length, num: mm[0], marks: first.marks });
      }
      const pts = POINTS_RE.exec(text);
      if (pts) total += parseFloat(pts[1].replace(",", "."));
    }
    return false;
  });
  found.forEach((f, i) => (f.num = String(i + 1)));
  for (const f of [...found].reverse()) {
    tr.replaceWith(f.from, f.to, schema.text(f.num, f.marks));
  }
  if (found.length) editor.view.dispatch(tr);
  return { count: found.length, total: Math.round(total * 100) / 100 };
}

export type TemplateId = "header" | "exercise" | "problem" | "qcm" | "truefalse" | "holes";

export function exerciseTemplate(id: TemplateId, L: Tr, n: number): JSONContent[] {
  switch (id) {
    case "header":
      return [
        table([
          row([cell([b(L("Établissement : ", "المؤسسة: ", "School: ")), t("……………………")]), cell([b(L("Niveau : ", "المستوى: ", "Level: ")), t("…………")]), cell([b(L("Durée : ", "المدة: ", "Duration: ")), t("2 h")])]),
          row([cell([b(L("Nom et prénom : ", "الاسم الكامل: ", "Name: ")), t("……………………")]), cell([b(L("Classe : ", "القسم: ", "Class: ")), t("…………")]), cell([b(L("Note : ", "النقطة: ", "Mark: ")), t("……… / 20")])]),
        ]),
        h(1, [t(L("Devoir surveillé n° 1", "فرض محروس رقم 1", "Test n° 1"))]),
        p([t(L("Le sujet comporte … exercices. La calculatrice est autorisée.", "يتضمن الموضوع … تمارين. الآلة الحاسبة مسموح بها.", "The paper has … exercises. Calculators are allowed."))], { textAlign: "center" }),
      ];
    case "exercise":
      return [
        h(3, [t(L(`Exercice ${n} (4 points)`, `التمرين ${n} (4 نقط)`, `Exercise ${n} (4 points)`))]),
        p([t(L("Soit ", "لتكن ", "Let ")), math("f"), t(L(" la fonction définie sur ", " الدالة المعرفة على ", " be the function defined on ")), math("\\mathbb{R}"), t(L(" par ", " بما يلي ", " by ")), math("f(x)=x^{2}-4x+3"), t(".")]),
        ol([
          li([t(L("Calculer ", "احسب ", "Compute ")), math("f(0)"), t(L(" et ", " و ", " and ")), math("f(1)"), t(".")]),
          li([t(L("Montrer que pour tout réel ", "بين أنه لكل عدد حقيقي ", "Show that for every real ")), math("x"), t(" : "), math("f(x)=(x-2)^{2}-1"), t(".")]),
          li([t(L("En déduire :", "استنتج:", "Deduce:"))], ol([
            li([t(L("les solutions de l'équation ", "حلول المعادلة ", "the solutions of ")), math("f(x)=0"), t(" ;")]),
            li([t(L("le tableau de variations de ", "جدول تغيرات ", "the variation table of ")), math("f"), t(".")]),
          ], "a")),
        ]),
      ];
    case "problem":
      return [
        h(3, [t(L(`Problème (8 points)`, `مسألة (8 نقط)`, `Problem (8 points)`))]),
        h(4, [t(L("Partie A", "الجزء الأول", "Part A"))]),
        ol([li([t(L("Question…", "سؤال…", "Question…"))]), li([t(L("Question…", "سؤال…", "Question…"))])]),
        h(4, [t(L("Partie B", "الجزء الثاني", "Part B"))]),
        ol([li([t(L("Question…", "سؤال…", "Question…"))]), li([t(L("Question…", "سؤال…", "Question…"))])]),
      ];
    case "qcm":
      return [
        h(3, [t(L(`Exercice ${n} : QCM (3 points)`, `التمرين ${n}: أسئلة متعددة الاختيارات (3 نقط)`, `Exercise ${n}: multiple choice (3 points)`))]),
        p([t(L("Pour chaque question, une seule réponse est exacte. Cochez-la.", "لكل سؤال جواب واحد صحيح. ضع علامة عليه.", "For each question, only one answer is correct. Tick it."))]),
        table([
          row([cell([], true), cell([t("A")], true), cell([t("B")], true), cell([t("C")], true)]),
          row([cell([t("1. "), math("\\sqrt{16}=")]), cell([t("☐ "), math("4")]), cell([t("☐ "), math("8")]), cell([t("☐ "), math("\\pm4")])]),
          row([cell([t("2. "), math("2^{3}\\times2^{2}=")]), cell([t("☐ "), math("2^{6}")]), cell([t("☐ "), math("2^{5}")]), cell([t("☐ "), math("4^{5}")])]),
          row([cell([t("3. "), math("(x+1)^{2}=")]), cell([t("☐ "), math("x^{2}+1")]), cell([t("☐ "), math("x^{2}+2x+1")]), cell([t("☐ "), math("x^{2}+x+1")])]),
        ]),
      ];
    case "truefalse":
      return [
        h(3, [t(L(`Exercice ${n} : Vrai ou faux (2 points)`, `التمرين ${n}: صحيح أم خطأ (2 ن)`, `Exercise ${n}: true or false (2 points)`))]),
        p([t(L("Répondre par vrai ou faux en justifiant.", "أجب بصحيح أو خطأ مع التعليل.", "Answer true or false and justify."))]),
        table([
          row([cell([t(L("Affirmation", "العبارة", "Statement"))], true), cell([t(L("Vrai", "صحيح", "True"))], true), cell([t(L("Faux", "خطأ", "False"))], true)]),
          row([cell([math("\\forall x\\in\\mathbb{R},\\ x^{2}\\geq0")]), cell([t("☐")]), cell([t("☐")])]),
          row([cell([math("\\sqrt{a+b}=\\sqrt{a}+\\sqrt{b}")]), cell([t("☐")]), cell([t("☐")])]),
          row([cell([t(L("Une fonction croissante est positive.", "كل دالة تزايدية موجبة.", "An increasing function is positive."))]), cell([t("☐")]), cell([t("☐")])]),
        ]),
      ];
    case "holes":
      return [
        h(3, [t(L(`Exercice ${n} : Compléter (2 points)`, `التمرين ${n}: أتمم (2 ن)`, `Exercise ${n}: fill in (2 points)`))]),
        ol([
          li([math("(a+b)^{2}=a^{2}+\\ldots\\ldots+b^{2}")]),
          li([t(L("Le discriminant de ", "مميز ", "The discriminant of ")), math("ax^{2}+bx+c"), t(L(" est ", " هو ", " is ")), math("\\Delta=\\ldots\\ldots")]),
          li([math("\\lim_{x\\to+\\infty}\\frac{1}{x}=\\ldots\\ldots")]),
        ]),
      ];
  }
}

export type BoxId = "definition" | "theorem" | "property" | "remark" | "example" | "method" | "proof";

export const BOXES: { id: BoxId; color: string; label: (L: Tr) => string }[] = [
  { id: "definition", color: "#E3EEFB", label: (L) => L("Définition", "تعريف", "Definition") },
  { id: "theorem", color: "#FBE6E6", label: (L) => L("Théorème", "مبرهنة", "Theorem") },
  { id: "property", color: "#E5F4E8", label: (L) => L("Propriété", "خاصية", "Property") },
  { id: "remark", color: "#FFF4D6", label: (L) => L("Remarque", "ملاحظة", "Remark") },
  { id: "example", color: "#F1ECFA", label: (L) => L("Exemple", "مثال", "Example") },
  { id: "method", color: "#E2F5F6", label: (L) => L("Méthode", "طريقة", "Method") },
  { id: "proof", color: "", label: (L) => L("Démonstration", "برهان", "Proof") },
];

export function boxTemplate(id: BoxId, L: Tr): JSONContent[] {
  const box = BOXES.find((x) => x.id === id)!;
  if (id === "proof") return [p([t(box.label(L) + " : ", [{ type: "bold" }, { type: "italic" }])])];
  return [p([b(box.label(L) + " : ")], { border: "box", shading: box.color })];
}
