"use client";

/**
 * Onglet « Maths » du ruban Word : tout ce qui sert à écrire et modifier un énoncé.
 */
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import {
  BookMarked, CheckCircle2, DollarSign, Eye, EyeOff, FileSpreadsheet, Grid3x3, Hash, LayoutList, ListOrdered, Sigma, SquareFunction,
  Table2, Triangle, Wand2, Calculator, PenLine, SquareDashed,
} from "lucide-react";
import { toast } from "sonner";
import { BigBtn, MenuItem, RGroup, RMenu, RStack, SmallBtn } from "../../shared/Ribbon";
import type { Tr } from "../../shared/useOfficeEnv";
import { splitMath } from "@/lib/mathRender";
import { FORMULAS } from "./palettes";
import { BOXES, boxTemplate, exerciseTemplate, nextExerciseNumber, renumberExercises, type TemplateId } from "./exerciseTemplates";
import { paperSvg, repereSvg, svgSrc, type PaperKind } from "./grids";

/** Transforme les $…$ / $$…$$ d'un texte collé (ChatGPT, ancien document…) en vraies équations */
export function convertDollarMath(editor: Editor): number {
  const { state } = editor;
  const { tr, schema } = state;
  const mathType = schema.nodes.mathInline;
  const jobs: { from: number; to: number; nodes: import("@tiptap/pm/model").Node[] }[] = [];
  let count = 0;
  state.doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text || (!node.text.includes("$") && !node.text.includes("\\("))) return;
    if (parent?.type.name === "codeBlock" || node.marks.some((m) => m.type.name === "code")) return;
    const parts = splitMath(node.text);
    if (!parts.some((x) => x.t === "math")) return;
    const nodes = parts.map((x) => {
      if (x.t === "text") return schema.text(x.v, node.marks);
      count++;
      return mathType.create({ latex: x.v, display: !!x.display }, null, node.marks);
    });
    jobs.push({ from: pos, to: pos + node.nodeSize, nodes });
  });
  for (const j of jobs.reverse()) tr.replaceWith(j.from, j.to, j.nodes);
  if (count) editor.view.dispatch(tr);
  return count;
}

/**
 * Insère des blocs (exercice, encadré…) après le bloc principal où se trouve le curseur,
 * et pas à l'intérieur d'une liste ou d'un tableau. Un paragraphe vide est remplacé.
 */
export function insertBlocks(ed: Editor, content: JSONContent[]) {
  const { $from } = ed.state.selection;
  if ($from.depth < 1) return ed.chain().focus().insertContent(content).run();
  const top = $from.node(1);
  const start = $from.before(1);
  const empty = top.type.name === "paragraph" && top.content.size === 0;
  const range = empty ? { from: start, to: start + top.nodeSize } : { from: start + top.nodeSize, to: start + top.nodeSize };
  return ed.chain().focus().insertContentAt(range, content).run();
}

export function MathTab({
  ed, L, contentWidthPx, onEquation, onVarTable, onGeoGebra, onNumbers, hideCorrections, setHideCorrections, autoDollar, setAutoDollar, isCorrection,
}: {
  ed: Editor;
  L: Tr;
  contentWidthPx: number;
  onEquation: (display: boolean) => void;
  onVarTable: () => void;
  onGeoGebra: () => void;
  onNumbers: () => void;
  hideCorrections: boolean;
  setHideCorrections: (v: boolean) => void;
  autoDollar: boolean;
  setAutoDollar: (v: boolean) => void;
  isCorrection: boolean;
}) {
  const [rp, setRp] = useState({ xmin: -5, xmax: 5, ymin: -4, ymax: 4, unit: 1, grid: true, labels: true });
  const [paperH, setPaperH] = useState(6);
  const ins = (content: JSONContent[] | JSONContent) => insertBlocks(ed, Array.isArray(content) ? content : [content]);
  const insertImage = (svg: string, width?: number) => ed.chain().focus().setImage({ src: svgSrc(svg), ...(width ? { width } : {}) } as any).run();
  const tpl = (id: TemplateId) => ins(exerciseTemplate(id, L, nextExerciseNumber(ed)));

  const templates: { id: TemplateId; label: string; icon: typeof Hash }[] = [
    { id: "header", label: L("En-tête de devoir", "رأس الفرض", "Test header"), icon: FileSpreadsheet },
    { id: "exercise", label: L("Exercice numéroté + questions", "تمرين مرقم + أسئلة", "Numbered exercise + questions"), icon: ListOrdered },
    { id: "problem", label: L("Problème en parties (A, B)", "مسألة بأجزاء", "Problem in parts"), icon: LayoutList },
    { id: "qcm", label: L("QCM", "أسئلة متعددة الاختيارات", "Multiple choice"), icon: CheckCircle2 },
    { id: "truefalse", label: L("Vrai ou faux", "صحيح أم خطأ", "True or false"), icon: CheckCircle2 },
    { id: "holes", label: L("Compléter (texte à trous)", "أتمم الفراغات", "Fill in the blanks"), icon: PenLine },
  ];
  const papers: { kind: PaperKind; label: string }[] = [
    { kind: "lines", label: L("Lignes de réponse", "أسطر للإجابة", "Answer lines") },
    { kind: "squares", label: L("Quadrillage 5 mm", "شبكة 5 مم", "5 mm squares") },
    { kind: "mm", label: L("Papier millimétré", "ورق مليمتري", "Graph paper (mm)") },
    { kind: "dots", label: L("Papier pointé", "ورق منقط", "Dot paper") },
  ];
  const num = (k: keyof typeof rp, v: string) => setRp((r) => ({ ...r, [k]: Math.max(-20, Math.min(20, Number(v) || 0)) }));

  return (
    <>
      <RGroup label={L("Équations", "معادلات", "Equations")}>
        <BigBtn icon={Sigma} label={L("Équation", "معادلة", "Equation")} title={L("Nouvelle équation (Alt+=)", "معادلة جديدة (Alt+=)", "New equation (Alt+=)")} onClick={() => onEquation(false)} />
        <RMenu big icon={BookMarked} label={L("Formules", "صيغ", "Formulas")} width={360}>
          {(close) => (
            <div className="space-y-2">
              {FORMULAS.map((g) => (
                <div key={g.group(L)}>
                  <div className="px-2 pb-0.5 text-[11px] font-semibold text-muted-foreground">{g.group(L)}</div>
                  {g.items.map((q) => (
                    <MenuItem key={q.latex} label={<span className="font-mono text-[11px]" dir="ltr">{q.latex}</span>} hint={q.label} onClick={() => { ed.chain().focus().insertMath(q.latex).run(); close(); }} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </RMenu>
        <RStack>
          <SmallBtn icon={SquareFunction} label={L("Équation centrée", "معادلة في الوسط", "Display equation")} withLabel onClick={() => onEquation(true)} />
          <SmallBtn icon={Wand2} label={L("Convertir les $…$", "تحويل ‎$…$", "Convert $…$")} withLabel
            title={L("Transforme les formules écrites entre $…$ (texte collé depuis ChatGPT, un PDF…) en vraies équations", "يحول الصيغ المكتوبة بين ‎$…$ إلى معادلات حقيقية", "Turns formulas written between $…$ into real equations")}
            onClick={() => { const n = convertDollarMath(ed); toast[n ? "success" : "info"](n ? L(`${n} équation(s) créée(s)`, `تم إنشاء ${n} معادلة`, `${n} equation(s) created`) : L("Aucune formule $…$ trouvée", "لم يتم العثور على أي صيغة ‎$…$", "No $…$ formula found")); }} />
          <SmallBtn icon={DollarSign} label={L("Saisie $…$ automatique", "إدخال ‎$…$ تلقائي", "Auto $…$ typing")} withLabel active={autoDollar}
            title={L("Taper $x^2$ crée directement une équation", "كتابة ‎$x^2$ تنشئ معادلة مباشرة", "Typing $x^2$ creates an equation")} onClick={() => setAutoDollar(!autoDollar)} />
        </RStack>
      </RGroup>

      <RGroup label={L("Énoncés", "نصوص التمارين", "Exercises")}>
        <RMenu big icon={ListOrdered} label={L("Modèles", "نماذج", "Templates")} width={270}>
          {(close) => templates.map((x) => <MenuItem key={x.id} icon={x.icon} label={x.label} onClick={() => { tpl(x.id); close(); }} />)}
        </RMenu>
        <RMenu big icon={SquareDashed} label={L("Encadrés", "إطارات", "Boxes")} width={220}>
          {(close) => BOXES.map((x) => (
            <MenuItem key={x.id} label={<span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-sm border" style={{ background: x.color || "transparent" }} />{x.label(L)}</span>} onClick={() => { ins(boxTemplate(x.id, L)); ed.chain().focus().unsetBold().unsetItalic().run(); close(); }} />
          ))}
        </RMenu>
        <RStack>
          <SmallBtn icon={Hash} label={L("Renuméroter les exercices", "إعادة ترقيم التمارين", "Renumber exercises")} withLabel
            onClick={() => {
              const r = renumberExercises(ed);
              if (!r.count) toast.info(L("Aucun titre « Exercice … » trouvé.", "لم يتم العثور على أي عنوان «التمرين …».", "No “Exercise …” heading found."));
              else toast.success(L(`${r.count} exercice(s) renuméroté(s). Barème total : ${r.total} points`, `تمت إعادة ترقيم ${r.count} تمرين. مجموع النقط: ${r.total}`, `${r.count} exercise(s) renumbered. Total: ${r.total} points`));
            }} />
          <SmallBtn icon={Calculator} label={L("Changer les nombres", "تغيير الأعداد", "Change numbers")} withLabel onClick={onNumbers} />
        </RStack>
      </RGroup>

      <RGroup label={L("Tableaux et figures", "جداول وأشكال", "Tables & figures")}>
        <BigBtn icon={Table2} label={L("Signes / variations", "إشارة / تغيرات", "Signs / variations")} onClick={onVarTable} />
        <BigBtn icon={Triangle} label={L("Figure GeoGebra", "شكل GeoGebra", "GeoGebra figure")} onClick={onGeoGebra} />
        <RMenu big icon={Grid3x3} label={L("Repère", "معلم", "Axes")} width={250}>
          {(close) => (
            <div className="space-y-2 p-1 text-[12px]">
              <div className="grid grid-cols-2 gap-1.5" dir="ltr">
                {(["xmin", "xmax", "ymin", "ymax"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1">{k} <input type="number" value={rp[k]} onChange={(e) => num(k, e.target.value)} className="h-7 w-full rounded border bg-background px-1" /></label>
                ))}
              </div>
              <label className="flex items-center gap-1.5">{L("Unité", "الوحدة", "Unit")}
                <select value={rp.unit} onChange={(e) => setRp({ ...rp, unit: Number(e.target.value) })} className="h-7 rounded border bg-background px-1">
                  {[0.5, 1, 1.5, 2].map((u) => <option key={u} value={u}>{String(u).replace(".", ",")} cm</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={rp.grid} onChange={(e) => setRp({ ...rp, grid: e.target.checked })} /> {L("Quadrillage", "شبكة", "Grid")}</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={rp.labels} onChange={(e) => setRp({ ...rp, labels: e.target.checked })} /> {L("Graduations", "تدريجات", "Ticks")}</label>
              <button type="button" className="w-full rounded-md bg-[#2B579A] py-1.5 text-white hover:bg-[#244a85]"
                onClick={() => {
                  const o = { ...rp, xmax: Math.max(rp.xmax, rp.xmin + 1), ymax: Math.max(rp.ymax, rp.ymin + 1) };
                  insertImage(repereSvg(o));
                  close();
                }}>{L("Insérer le repère", "إدراج المعلم", "Insert axes")}</button>
            </div>
          )}
        </RMenu>
        <RMenu big icon={PenLine} label={L("Zone de réponse", "مكان الإجابة", "Answer space")} width={230}>
          {(close) => (
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 px-2 pb-1 text-[12px]">{L("Hauteur", "الارتفاع", "Height")}
                <select value={paperH} onChange={(e) => setPaperH(Number(e.target.value))} className="h-7 rounded border bg-background px-1">
                  {[2, 3, 4, 6, 8, 10, 15, 20].map((v) => <option key={v} value={v}>{v} cm</option>)}
                </select>
              </label>
              {papers.map((x) => <MenuItem key={x.kind} label={x.label} onClick={() => { insertImage(paperSvg(x.kind, contentWidthPx, paperH)); close(); }} />)}
            </div>
          )}
        </RMenu>
      </RGroup>

      <RGroup label={L("Corrigé", "التصحيح", "Answer key")}>
        <BigBtn icon={CheckCircle2} label={L("Corrigé", "تصحيح", "Answer")} active={isCorrection}
          title={L("Le texte sélectionné devient du corrigé (Ctrl+Maj+K). Masquez-le pour imprimer la version élève.", "يصبح النص المحدد تصحيحا (Ctrl+Shift+K). أخفه لطباعة نسخة التلميذ.", "Selected text becomes answer key (Ctrl+Shift+K). Hide it to print the student version.")}
          onClick={() => ed.chain().focus().toggleCorrection().run()} />
        <RStack>
          <SmallBtn icon={hideCorrections ? Eye : EyeOff} label={hideCorrections ? L("Afficher le corrigé", "إظهار التصحيح", "Show answers") : L("Version élève (masquer)", "نسخة التلميذ (إخفاء)", "Student version (hide)")} withLabel active={hideCorrections} onClick={() => setHideCorrections(!hideCorrections)} />
          <SmallBtn icon={PenLine} label={L("Bloc « Correction »", "فقرة «التصحيح»", "“Answer” block")} withLabel
            onClick={() => { ins({ type: "paragraph", content: [{ type: "text", text: L("Correction : ", "التصحيح: ", "Answer: "), marks: [{ type: "bold" }, { type: "correction" }] }] }); ed.chain().focus().unsetBold().setMark("correction").run(); }} />
        </RStack>
      </RGroup>
    </>
  );
}
