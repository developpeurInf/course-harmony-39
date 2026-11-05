"use client";

/**
 * Éditeur d'équations visuel (équivalent libre de MathType) basé sur MathLive :
 * saisie au clavier comme sur papier (/ = fraction, ^ = exposant…), palettes de
 * structures et de symboles, formules toutes faites, code LaTeX modifiable,
 * clavier virtuel (tablettes). Si MathLive ne peut pas se charger (navigateur très
 * ancien), on bascule sur une saisie LaTeX avec aperçu KaTeX.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Keyboard, Keyboard as KeyboardIcon, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadKatex, renderLatexToString } from "@/lib/mathRender";
import type { Tr } from "../../shared/useOfficeEnv";
import { MathOverlay } from "./MathOverlay";
import { loadMathLive, latexToMarkup, setupMathfield } from "./mathlive";
import { FORMULAS, PALETTES, SHORTCUT_HELP, cleanLatex, previewLatex } from "./palettes";
import "mathlive/static.css";
import "./math.css";

type ML = typeof import("mathlive");

export interface EquationRequest {
  latex: string;
  display: boolean;
  /** position du nœud à modifier (sinon insertion) */
  pos?: number;
}

export function EquationDialog({
  request, onClose, onSubmit, L, language, dir,
}: {
  request: EquationRequest | null;
  onClose: () => void;
  onSubmit: (latex: string, display: boolean, pos?: number) => void;
  L: Tr;
  language: string;
  dir: "ltr" | "rtl";
}) {
  const open = !!request;
  const [ml, setMl] = useState<ML | null>(null);
  const [failed, setFailed] = useState(false);
  const [latex, setLatex] = useState("");
  const [display, setDisplay] = useState(false);
  const [cat, setCat] = useState<string>("struct");
  const [showCode, setShowCode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<(HTMLElement & Record<string, any>) | null>(null);
  const [katexHtml, setKatexHtml] = useState("");

  // ouverture : chargement de MathLive puis création du champ
  useEffect(() => {
    if (!request) return;
    setLatex(request.latex);
    setDisplay(request.display);
    let cancelled = false;
    loadMathLive(language).then((m) => { if (!cancelled) setMl(m); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [request, language]);

  useEffect(() => {
    if (!open || !ml || !hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = "";
    const mf = document.createElement("math-field") as HTMLElement & Record<string, any>;
    mf.className = "eq-field";
    mf.setAttribute("dir", "ltr");
    host.appendChild(mf);
    setupMathfield(mf);
    mf.value = request?.latex || "";
    const onInput = () => setLatex(mf.value as string);
    mf.addEventListener("input", onInput);
    mfRef.current = mf;
    const t = setTimeout(() => { mf.focus(); try { mf.executeCommand("moveToMathfieldEnd"); } catch { /* */ } }, 30);
    return () => {
      clearTimeout(t);
      mf.removeEventListener("input", onInput);
      try { (window as any).mathVirtualKeyboard?.hide(); } catch { /* */ }
      mfRef.current = null;
      host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ml]);

  // aperçu KaTeX pour la saisie de secours
  useEffect(() => {
    if (!open || !failed) return;
    loadKatex().then((k) => setKatexHtml(renderLatexToString(k, latex || "\\square", display))).catch(() => setKatexHtml(""));
  }, [open, failed, latex, display]);

  const insert = (tpl: string) => {
    const mf = mfRef.current;
    if (mf) {
      mf.insert(tpl, { selectionMode: "placeholder", format: "latex", focus: true });
      setLatex(mf.value as string);
    } else {
      setLatex((v) => v + tpl.replace(/#0|#\?/g, "{}"));
    }
  };
  const setFromCode = (v: string) => {
    setLatex(v);
    if (mfRef.current) mfRef.current.value = v;
  };

  const submit = () => {
    const v = cleanLatex(mfRef.current ? (mfRef.current.value as string) : latex);
    if (!v) { onClose(); return; }
    onSubmit(v, display, request?.pos);
  };

  // Ctrl+Entrée = valider
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  });

  const palette = PALETTES.find((p) => p.id === cat);
  const cats = [...PALETTES.map((p) => ({ id: p.id, label: p.label(L) })), { id: "formulas", label: L("Formules", "صيغ", "Formulas") }];
  const markup = useMemo(() => {
    const out: Record<string, string> = {};
    if (!ml) return out;
    for (const p of PALETTES) for (const it of p.items) out[it.latex] = latexToMarkup(ml, previewLatex(it.show || it.latex));
    for (const g of FORMULAS) for (const it of g.items) out[it.latex] = latexToMarkup(ml, it.latex);
    return out;
  }, [ml]);

  const toggleKeyboard = () => {
    const vk = (window as any).mathVirtualKeyboard;
    if (!vk) return;
    mfRef.current?.focus();
    if (vk.visible) vk.hide(); else vk.show();
  };

  return (
    <MathOverlay
      open={open}
      onClose={onClose}
      dir={dir}
      icon={<Sigma className="h-4 w-4" />}
      title={request?.pos != null ? L("Modifier l'équation", "تعديل المعادلة", "Edit equation") : L("Nouvelle équation", "معادلة جديدة", "New equation")}
      subtitle={L(
        "Tapez comme sur papier : / fraction, ^ exposant, _ indice, sqrt racine, RR pour ℝ… ou cliquez dans les palettes.",
        "اكتب كما على الورق: / كسر، ^ أس، _ مؤشر، sqrt جذر، RR للمجموعة ℝ… أو انقر على اللوحات.",
        "Type as on paper: / fraction, ^ power, _ subscript, sqrt root, RR for ℝ… or click the palettes."
      )}
      footer={
        <>
          <label className="me-auto flex cursor-pointer items-center gap-2 text-[13px]">
            <input type="checkbox" checked={display} onChange={(e) => setDisplay(e.target.checked)} className="accent-[#2B579A]" />
            {L("Centrée sur sa propre ligne", "في سطر مستقل وسط الصفحة", "Centered on its own line")}
          </label>
          <Button variant="outline" size="sm" onClick={onClose}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button size="sm" onClick={submit} className="bg-[#2B579A] text-white hover:bg-[#244a85]">
            {request?.pos != null ? L("Mettre à jour", "تحديث", "Update") : L("Insérer", "إدراج", "Insert")}
            <span className="ms-1.5 hidden text-[10px] opacity-70 sm:inline">Ctrl+↵</span>
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-3 sm:p-4">
        {/* Catégories de palettes */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]" role="tablist">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCat(c.id)}
              className={cn("shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] transition-colors", cat === c.id ? "bg-[#2B579A] text-white" : "bg-muted/70 hover:bg-muted")}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Boutons de la palette */}
        <div className="eq-palette max-h-[176px] overflow-y-auto rounded-lg border bg-background p-1.5" dir="ltr">
          {cat === "formulas" ? (
            <div className="space-y-2">
              {FORMULAS.map((g) => (
                <div key={g.group(L)}>
                  <div className="mb-1 px-1 text-[11px] font-semibold text-muted-foreground" dir={dir}>{g.group(L)}</div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((it) => (
                      <button key={it.latex} type="button" title={it.label} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(it.latex)}
                        className="flex min-h-[40px] items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-start hover:border-[#2B579A]/40 hover:bg-[#2B579A]/5">
                        <span className="w-20 shrink-0 truncate text-[10px] text-muted-foreground">{it.label}</span>
                        {markup[it.latex] ? <span className="eq-btn-math min-w-0 truncate text-[13px]" dangerouslySetInnerHTML={{ __html: markup[it.latex] }} /> : <code className="truncate text-[10px]">{it.latex}</code>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {palette?.items.map((it) => (
                <button key={it.latex} type="button" title={it.tip || it.latex} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(it.latex)}
                  className="flex min-h-[40px] min-w-[42px] items-center justify-center rounded-md border border-transparent px-1.5 py-1 hover:border-[#2B579A]/40 hover:bg-[#2B579A]/5">
                  {markup[it.latex] ? <span className="eq-btn-math pointer-events-none text-[14px]" dangerouslySetInnerHTML={{ __html: markup[it.latex] }} /> : <code className="text-[10px]">{it.latex.replace(/#0|#\?/g, "□")}</code>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zone de saisie */}
        {failed ? (
          <div className="space-y-2">
            <p className="text-xs text-amber-700 dark:text-amber-400">{L("L'éditeur visuel n'a pas pu se charger sur ce navigateur : saisissez le code LaTeX, l'aperçu s'affiche en dessous.", "تعذر تحميل المحرر المرئي على هذا المتصفح: اكتب شيفرة LaTeX وستظهر المعاينة أسفله.", "The visual editor could not load in this browser: type LaTeX, the preview appears below.")}</p>
            <textarea value={latex} onChange={(e) => setLatex(e.target.value)} dir="ltr" rows={3} className="w-full rounded-lg border bg-background p-2 font-mono text-[13px]" autoFocus />
            <div className="min-h-[70px] rounded-lg border bg-white p-3 text-center text-[20px] text-black" dir="ltr" dangerouslySetInnerHTML={{ __html: katexHtml }} />
          </div>
        ) : (
          <div className="relative">
            <div ref={hostRef} className="eq-host min-h-[96px] rounded-lg border-2 border-[#2B579A]/30 bg-white text-black focus-within:border-[#2B579A]" />
            {!ml && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{L("Chargement de l'éditeur…", "جارٍ تحميل المحرر…", "Loading editor…")}</div>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {!failed && (
            <>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowCode((v) => !v)}>
                <Braces className="h-3.5 w-3.5" /> {L("Code LaTeX", "شيفرة LaTeX", "LaTeX code")}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]" onMouseDown={(e) => e.preventDefault()} onClick={toggleKeyboard}>
                <KeyboardIcon className="h-3.5 w-3.5" /> {L("Clavier virtuel", "لوحة مفاتيح افتراضية", "Virtual keyboard")}
              </Button>
            </>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowHelp((v) => !v)}>
            <Keyboard className="h-3.5 w-3.5" /> {L("Raccourcis", "اختصارات", "Shortcuts")}
          </Button>
        </div>

        {showCode && !failed && (
          <textarea value={latex} onChange={(e) => setFromCode(e.target.value)} dir="ltr" rows={2} spellCheck={false}
            className="w-full rounded-lg border bg-background p-2 font-mono text-[12px]" aria-label="LaTeX" />
        )}
        {showHelp && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border bg-muted/30 p-2.5 text-[12px] sm:grid-cols-3">
            {SHORTCUT_HELP.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-1.5"><kbd className="rounded border bg-background px-1 font-mono text-[11px]" dir="ltr">{k}</kbd><span className="text-muted-foreground">{v}</span></div>
            ))}
          </div>
        )}
      </div>
    </MathOverlay>
  );
}
