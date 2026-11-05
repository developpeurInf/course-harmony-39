/**
 * QCM sur papier : impression de feuilles-réponses (une par élève, numérotée), puis lecture
 * des photos par l'IA (fonction teacher-ai, action « omr »). Le professeur vérifie chaque
 * feuille (élève, réponses lues) avant l'enregistrement (rpc record_paper_submission).
 */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Loader2, Printer, Save, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { escapeHtml, getReportBranding, reportHeaderLines } from "@/lib/reportBranding";
import { openPrintable } from "@/lib/appreciations";
import { aiErrorMessage, callTeacherAi } from "@/lib/teacherAi";

type Tr = (fr: string, ar: string, en: string) => string;
interface Q { id: string; question_order: number; question_type: string; points: number }
interface O { id: string; question_id: string; is_correct: boolean; option_order: number }
interface S { id: string; name: string }
interface Sheet {
  key: string;
  preview: string;
  status: "reading" | "done" | "error";
  error?: string;
  studentId: string;
  /** Une entrée par ligne de la feuille : lettres cochées, ex. "A", "AC", "" */
  marks: string[];
  doubtful: number[];
}

const LETTERS = "ABCDEF";

/** Photo → JPEG ≤ 1600 px, base64 sans en-tête */
function compress(file: File): Promise<{ b64: string; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(src);
      resolve({ b64: url.split(",")[1] || "", url });
    };
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

export function PaperQuizDialog({ open, onOpenChange, examId, title, roomName, questions, options, students, tr, language, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  examId: string;
  title: string;
  roomName: string;
  questions: Q[];
  options: O[];
  students: S[];
  tr: Tr;
  language: string;
  onSaved: () => void | Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [saving, setSaving] = useState(false);

  // Lignes de la feuille = questions à choix (les réponses rédigées se corrigent à part)
  const rows = useMemo(
    () => [...questions].filter((q) => q.question_type !== "short_answer").sort((a, b) => a.question_order - b.question_order || a.id.localeCompare(b.id)),
    [questions]
  );
  const optsOf = useMemo(() => {
    const m = new Map<string, O[]>();
    rows.forEach((q) => m.set(q.id, options.filter((o) => o.question_id === q.id).sort((a, b) => a.option_order - b.option_order).slice(0, 6)));
    return m;
  }, [rows, options]);
  const hasShort = questions.some((q) => q.question_type === "short_answer");

  const scoreOf = (marks: string[]) => {
    let s = 0;
    let t = 0;
    rows.forEach((q, i) => {
      const pts = q.points || 1;
      t += pts;
      const opts = optsOf.get(q.id) || [];
      const chosen = new Set((marks[i] || "").split("").map((l) => opts[LETTERS.indexOf(l)]?.id).filter(Boolean));
      const correct = opts.filter((o) => o.is_correct).map((o) => o.id);
      if (correct.length && chosen.size === correct.length && correct.every((id) => chosen.has(id))) s += pts;
    });
    return { s, t };
  };

  const printSheets = (blank: boolean) => {
    const lang = language === "ar" ? "ar" : "fr";
    const b = getReportBranding(lang);
    const head = reportHeaderLines(b).map((l) => `<div>${escapeHtml(l)}</div>`).join("");
    const L = lang === "ar"
      ? { name: "الاسم", n: "رقم الورقة", hint: "املأ خانة واحدة لكل سؤال بقلم أسود أو أزرق. للتراجع: اشطب الخانة بالكامل وضع دائرة حول الجواب الجديد.", short: "الأسئلة ذات الجواب المكتوب تنجز على ورقة منفصلة." }
      : { name: "Nom", n: "Feuille N°", hint: "Noircissez une case par question, au stylo noir ou bleu. Pour corriger : barrez entièrement la case et entourez la nouvelle réponse.", short: "Les questions à réponse rédigée se font sur une feuille à part." };
    const list = blank ? [{ id: "", name: "" }] : students;
    const cols = rows.length > 20 ? 2 : 1;
    const grid = rows.map((q, i) => {
      const n = (optsOf.get(q.id) || []).length || 2;
      return `<div class="row"><span class="num">${i + 1}</span>${LETTERS.slice(0, n).split("").map((l) => `<span class="box">${l}</span>`).join("")}</div>`;
    }).join("");
    const pages = list.map((s, k) => `<section class="page">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div class="head">${head}</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="who"><div>${L.name} : <b>${escapeHtml(s.name)}</b>${blank ? "<span class='line'></span>" : ""}</div><div class="no">${L.n} <b>${blank ? "____" : `#${k + 1}`}</b></div><div>${escapeHtml(roomName)}</div></div>
      <p class="hint">${L.hint}</p>
      <div class="grid" style="column-count:${cols}">${grid}</div>
      ${hasShort ? `<p class="hint">${L.short}</p>` : ""}
    </section>`).join("");
    openPrintable(`<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>@page{size:A4;margin:10mm}body{font-family:${lang === "ar" ? "'Noto Naskh Arabic',Tahoma," : ""}'Segoe UI',Arial,sans-serif;color:#111;margin:0}
.page{position:relative;page-break-after:always;padding:10mm 8mm;min-height:260mm;box-sizing:border-box}.page:last-child{page-break-after:auto}
.corner{position:absolute;width:9mm;height:9mm;background:#000}.tl{top:0;left:0}.tr{top:0;right:0}.bl{bottom:0;left:0}.br{bottom:0;right:0}
.head{font-weight:600;font-size:12px;line-height:1.4;border-bottom:2px solid #222;padding-bottom:4px}h1{text-align:center;font-size:17px;margin:8px 0}
.who{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1.5px solid #222;padding:8px 10px;font-size:14px}.no b{font-size:22px}.line{display:inline-block;width:60mm;border-bottom:1px solid #000}
.hint{font-size:11px;color:#333;margin:6px 0}.grid{margin-top:6px;column-gap:14mm}.row{display:flex;align-items:center;gap:5mm;padding:2.2mm 0;break-inside:avoid;direction:ltr}
.num{width:9mm;text-align:right;font-weight:700;font-size:15px}.box{width:8mm;height:8mm;border:1.6px solid #000;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#777}</style></head>
<body>${pages}<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script></body></html>`);
  };

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!accessStore.guard("ai.omr")) return;
    const layout = rows.map((q) => (optsOf.get(q.id) || []).length || 2);
    const items: { file: File; key: string }[] = Array.from(files).map((f, i) => ({ file: f, key: `${Date.now()}-${i}-${f.name}` }));
    const prepared = await Promise.all(items.map(async (it) => ({ ...it, img: await compress(it.file).catch(() => null) })));
    setSheets((l) => [...l, ...prepared.map((p) => ({ key: p.key, preview: p.img?.url || "", status: p.img ? "reading" as const : "error" as const, error: p.img ? undefined : tr("Image illisible", "صورة غير مقروءة", "Unreadable image"), studentId: "", marks: [], doubtful: [] }))]);
    // 3 lectures en parallèle
    let next = 0;
    const worker = async () => {
      while (next < prepared.length) {
        const p = prepared[next++];
        if (!p.img) continue;
        try {
          const r = await callTeacherAi<{ sheet: { readable: boolean; sheet_number: string; student_name: string; answers: { n: number; marked: string[]; doubtful: boolean }[] } }>({
            action: "omr", image: p.img.b64, options_per_question: layout,
          });
          const sh = r.sheet;
          const marks = rows.map((_, i) => {
            const a = sh.answers.find((x) => x.n === i + 1);
            return (a?.marked || []).map((x) => String(x).trim().toUpperCase()).filter((x) => LETTERS.includes(x) && x.length === 1).sort().join("");
          });
          const doubtful = sh.answers.filter((a) => a.doubtful).map((a) => a.n - 1);
          const num = parseInt(String(sh.sheet_number || "").replace(/\D/g, ""), 10);
          const byNum = num >= 1 && num <= students.length ? students[num - 1] : undefined;
          const nameNorm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
          const byName = sh.student_name ? students.find((s) => nameNorm(s.name) === nameNorm(sh.student_name)) : undefined;
          setSheets((l) => l.map((x) => (x.key === p.key ? {
            ...x,
            status: sh.readable ? "done" : "error",
            error: sh.readable ? undefined : tr("Photo floue ou feuille non reconnue", "صورة غير واضحة أو ورقة غير معروفة", "Blurry photo or unknown sheet"),
            studentId: byNum?.id || byName?.id || "",
            marks,
            doubtful,
          } : x)));
        } catch (e: any) {
          setSheets((l) => l.map((x) => (x.key === p.key ? { ...x, status: "error", error: aiErrorMessage(String(e?.message || ""), tr) } : x)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  const ready = sheets.filter((s) => s.status === "done" && s.studentId);
  const dupes = new Set(ready.map((s) => s.studentId).filter((id, i, a) => a.indexOf(id) !== i));

  const saveAll = async () => {
    if (!ready.length || saving) return;
    if (!accessStore.guard("ai.omr")) return;
    setSaving(true);
    let ok = 0;
    for (const sh of ready) {
      const answers = rows.map((q, i) => ({
        question_id: q.id,
        selected_option_ids: (sh.marks[i] || "").split("").map((l) => (optsOf.get(q.id) || [])[LETTERS.indexOf(l)]?.id).filter(Boolean),
      }));
      const { error } = await (supabase as any).rpc("record_paper_submission", { p_exam_id: examId, p_student_id: sh.studentId, p_answers: answers });
      if (error) {
        console.error(error);
        setSheets((l) => l.map((x) => (x.key === sh.key ? { ...x, error: tr("Non enregistrée", "لم تحفظ", "Not saved") } : x)));
      } else {
        ok += 1;
        setSheets((l) => l.filter((x) => x.key !== sh.key));
      }
    }
    setSaving(false);
    toast.success(tr(`${ok} copie(s) enregistrée(s).`, `تم حفظ ${ok} ورقة.`, `${ok} sheet(s) saved.`));
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[94vh] w-[96vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-muted-foreground" />{tr("QCM sur papier", "اختيار من متعدد على الورق", "Paper multiple choice")}</DialogTitle>
          <DialogDescription>
            {tr("1. Imprimez les feuilles-réponses (une par élève, numérotée). 2. Photographiez les feuilles remplies, bien à plat. 3. Vérifiez la lecture et enregistrez : les notes arrivent dans les résultats du quiz.",
              "1. اطبع أوراق الأجوبة (ورقة مرقمة لكل تلميذ). 2. صوّر الأوراق المملوءة بشكل مستو. 3. تحقق من القراءة واحفظ: تظهر النقط في نتائج الاختبار.",
              "1. Print the answer sheets (one numbered sheet per student). 2. Photograph the filled sheets, flat. 3. Check the reading and save: grades appear in the quiz results.")}
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{tr("Ce quiz n'a pas de question à choix.", "لا يحتوي هذا الاختبار على أسئلة اختيار.", "This quiz has no choice questions.")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => printSheets(false)} disabled={!students.length}><Printer className="h-4 w-4" />{tr(`Feuilles nominatives (${students.length})`, `أوراق بالأسماء (${students.length})`, `Named sheets (${students.length})`)}</Button>
              <Button variant="outline" className="gap-1.5" onClick={() => printSheets(true)}><Printer className="h-4 w-4" />{tr("Feuille vierge", "ورقة فارغة", "Blank sheet")}</Button>
              <Button className="gap-1.5" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" />{tr("Ajouter des photos", "إضافة صور", "Add photos")}</Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void readFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {sheets.length > 0 && (
              <ul className="space-y-2">
                {sheets.map((sh) => {
                  const sc = scoreOf(sh.marks);
                  return (
                    <li key={sh.key} className={cn("flex gap-3 rounded-xl border p-2", sh.status === "error" && "border-rose-300")}>
                      {sh.preview ? <a href={sh.preview} target="_blank" rel="noreferrer"><img src={sh.preview} alt="" className="h-28 w-20 shrink-0 rounded object-cover" /></a> : <div className="h-28 w-20 shrink-0 rounded bg-muted" />}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {sh.status === "reading" ? (
                          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{tr("Lecture de la feuille…", "قراءة الورقة…", "Reading the sheet…")}</p>
                        ) : sh.status === "error" ? (
                          <p className="flex items-center gap-2 py-6 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" />{sh.error}</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <Select value={sh.studentId || "none"} onValueChange={(v) => setSheets((l) => l.map((x) => (x.key === sh.key ? { ...x, studentId: v === "none" ? "" : v } : x)))}>
                                <SelectTrigger className={cn("h-8 w-56", (!sh.studentId || dupes.has(sh.studentId)) && "border-amber-400")}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{tr("— Choisir l'élève —", "— اختر التلميذ —", "— Pick the student —")}</SelectItem>
                                  {students.map((s, i) => <SelectItem key={s.id} value={s.id}>#{i + 1} · {s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <span className="text-sm font-semibold tabular-nums">{sc.s} / {sc.t}</span>
                              {sh.error && <span className="text-xs text-rose-600">{sh.error}</span>}
                              {sh.studentId && dupes.has(sh.studentId) && <span className="text-xs text-amber-700">{tr("Élève en double", "تلميذ مكرر", "Duplicate student")}</span>}
                            </div>
                            <div className="flex flex-wrap gap-1" dir="ltr">
                              {rows.map((q, i) => {
                                const opts = optsOf.get(q.id) || [];
                                const good = opts.map((o, k) => (o.is_correct ? LETTERS[k] : "")).join("");
                                const m = sh.marks[i] || "";
                                return (
                                  <label key={q.id} className={cn("flex items-center gap-0.5 rounded border px-1 text-[11px]", m && m === good ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-rose-200", sh.doubtful.includes(i) && "ring-2 ring-amber-400")}
                                    title={`${tr("Bonne réponse", "الجواب الصحيح", "Answer")} : ${good}`}>
                                    <span className="text-muted-foreground">{i + 1}</span>
                                    <Input
                                      value={m}
                                      onChange={(e) => {
                                        const v = e.target.value.toUpperCase().split("").filter((c) => LETTERS.slice(0, opts.length).includes(c)).filter((c, k, a) => a.indexOf(c) === k).sort().join("");
                                        setSheets((l) => l.map((x) => (x.key === sh.key ? { ...x, marks: x.marks.map((mm, k) => (k === i ? v : mm)), doubtful: x.doubtful.filter((d) => d !== i) } : x)));
                                      }}
                                      className="h-6 w-9 border-0 bg-transparent p-0 text-center font-semibold uppercase"
                                      aria-label={`Q${i + 1}`}
                                    />
                                  </label>
                                );
                              })}
                            </div>
                            {sh.doubtful.length > 0 && <p className="text-[11px] text-amber-700">{tr("Cases entourées en orange : lecture incertaine, vérifiez sur la photo.", "الخانات المحاطة بالبرتقالي: قراءة غير مؤكدة، تحقق من الصورة.", "Orange boxes: uncertain reading, check the photo.")}</p>}
                          </>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-rose-600" onClick={() => setSheets((l) => l.filter((x) => x.key !== sh.key))} aria-label={tr("Retirer", "إزالة", "Remove")}><Trash2 className="h-4 w-4" /></Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{tr("Fermer", "إغلاق", "Close")}</Button>
          <Button onClick={() => void saveAll()} disabled={saving || !ready.length || dupes.size > 0} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr(`Enregistrer ${ready.length} copie(s)`, `حفظ ${ready.length} ورقة`, `Save ${ready.length} sheet(s)`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
