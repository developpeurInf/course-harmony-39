"use client";

/**
 * Création / modification d'un tableau de signes ou de variations.
 * Chaque case se règle d'un clic (+ / − / 0 / ||, flèches ↗ ↘ →) et l'aperçu
 * se met à jour en direct. Le tableau reste modifiable par double-clic dans le document.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, Plus, Sparkles, Table2, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tr } from "../../shared/useOfficeEnv";
import { MathOverlay } from "./MathOverlay";
import { PRESETS, arrowsFromSigns, emptyRow, parseVt, productSigns, renderVarTable, resize, svgToDataUrl, type RowType, type VtData, type VtRow } from "./varTable";

export interface VarTableRequest { data?: string; pos?: number }

const SIGN_CYCLE = ["", "+", "-"];
const VAL_CYCLE = ["", "0", "||"];
const ARROW_CYCLE = ["", "up", "down", "flat"];
const next = (cycle: string[], v: string) => cycle[(cycle.indexOf(v) + 1) % cycle.length];

export function VarTableDialog({
  request, onClose, onSubmit, L, dir,
}: {
  request: VarTableRequest | null;
  onClose: () => void;
  onSubmit: (json: string, pos?: number) => void;
  L: Tr;
  dir: "ltr" | "rtl";
}) {
  const [d, setD] = useState<VtData>(() => PRESETS[3].data());
  useEffect(() => {
    if (!request) return;
    setD(parseVt(request.data) || PRESETS[3].data());
  }, [request]);
  const n = d.xs.length;
  const cols = n * 2 - 1;
  const preview = useMemo(() => svgToDataUrl(renderVarTable(d).svg), [d]);

  const setRow = (ri: number, patch: Partial<VtRow>) => setD((p) => ({ ...p, rows: p.rows.map((r, i) => (i === ri ? { ...r, ...patch } : r)) }));
  const setCell = (ri: number, ci: number, v: string) => setD((p) => ({ ...p, rows: p.rows.map((r, i) => (i === ri ? { ...r, cells: r.cells.map((c, k) => (k === ci ? v : c)) } : r)) }));
  const addRow = (type: RowType) => setD((p) => ({ ...p, rows: [...p.rows, emptyRow(type, p.xs.length, type === "var" ? "f(x)" : "")] }));
  const moveRow = (ri: number, delta: number) => setD((p) => {
    const rows = [...p.rows];
    const j = ri + delta;
    if (j < 0 || j >= rows.length) return p;
    [rows[ri], rows[j]] = [rows[j], rows[ri]];
    return { ...p, rows };
  });
  const autoArrows = (ri: number) => {
    // flèches déduites de la dernière ligne de signes au-dessus (f'(x))
    const sign = [...d.rows.slice(0, ri)].reverse().find((r) => r.type === "sign");
    if (sign) setD((p) => ({ ...p, rows: p.rows.map((r, i) => (i === ri ? arrowsFromSigns(sign, r) : r)) }));
  };
  const autoProduct = (ri: number) => setD((p) => ({ ...p, rows: p.rows.map((r, i) => (i === ri ? { ...r, cells: productSigns(p.rows.slice(0, ri), p.xs.length) } : r)) }));

  const cellBtn = "flex h-8 min-w-[34px] items-center justify-center rounded border bg-background px-1 text-[13px] hover:border-[#2B579A]";

  return (
    <MathOverlay
      open={!!request}
      onClose={onClose}
      dir={dir}
      className="max-w-5xl"
      icon={<Table2 className="h-4 w-4" />}
      title={L("Tableau de signes / de variations", "جدول الإشارة / التغيرات", "Sign / variation table")}
      subtitle={L(
        "Cliquez sur une case pour changer son contenu. Écrivez -inf, +inf, sqrt(2), pi : ils s'affichent −∞, +∞, √2, π.",
        "انقر على خانة لتغيير محتواها. اكتب ‎-inf و‎+inf و‎sqrt(2) و‎pi لتظهر −∞ و+∞ و√2 وπ.",
        "Click a cell to change it. Type -inf, +inf, sqrt(2), pi: they show as −∞, +∞, √2, π."
      )}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button size="sm" className="bg-[#2B579A] text-white hover:bg-[#244a85]" onClick={() => onSubmit(JSON.stringify(d), request?.pos)}>
            {request?.pos != null ? L("Mettre à jour", "تحديث", "Update") : L("Insérer", "إدراج", "Insert")}
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> {L("Modèles :", "نماذج:", "Presets:")}</span>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => setD(p.data())} className="rounded-full border px-2.5 py-1 text-[12px] hover:border-[#2B579A] hover:bg-[#2B579A]/5">{p.label}</button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-muted/20 p-2" dir="ltr">
          <table className="border-separate border-spacing-1">
            <tbody>
              <tr>
                <td className="pe-1">
                  <input value={d.xLabel} onChange={(e) => setD({ ...d, xLabel: e.target.value })} className="h-8 w-24 rounded border bg-background px-1.5 text-[13px] italic" aria-label="x" />
                </td>
                {Array.from({ length: cols }, (_, i) => (
                  <td key={i} className="text-center">
                    {i % 2 === 0 ? (
                      <input value={d.xs[i / 2]} onChange={(e) => setD({ ...d, xs: d.xs.map((x, k) => (k === i / 2 ? e.target.value : x)) })}
                        className="h-8 w-[70px] rounded border bg-background px-1 text-center text-[13px] font-medium" aria-label={`x${i / 2}`} />
                    ) : <span className="text-[11px] text-muted-foreground">·</span>}
                  </td>
                ))}
                <td className="ps-2">
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled={n <= 2} onClick={() => setD(resize(d, n - 1))} title={L("Retirer une valeur", "حذف قيمة", "Remove value")}>−</Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled={n >= 9} onClick={() => setD(resize(d, n + 1))} title={L("Ajouter une valeur de x", "إضافة قيمة لـ x", "Add an x value")}>+</Button>
                  </div>
                </td>
              </tr>
              {d.rows.map((r, ri) => (
                <tr key={ri}>
                  <td className="pe-1">
                    <input value={r.label} onChange={(e) => setRow(ri, { label: e.target.value })} placeholder={r.type === "var" ? "f(x)" : "f'(x)"}
                      className="h-8 w-24 rounded border bg-background px-1.5 text-[13px] italic" aria-label={L("Nom de la ligne", "اسم السطر", "Row name")} />
                  </td>
                  {r.cells.map((c, ci) => (
                    <td key={ci} className="text-center align-middle">
                      {r.type === "sign" ? (
                        <button type="button" className={cn(cellBtn, ci % 2 === 1 ? "font-semibold" : "text-muted-foreground", c && "text-foreground")} onClick={() => setCell(ri, ci, next(ci % 2 === 1 ? SIGN_CYCLE : VAL_CYCLE, c))}>
                          {c === "-" ? "−" : c || (ci % 2 === 1 ? "·" : "│")}
                        </button>
                      ) : ci % 2 === 1 ? (
                        <button type="button" className={cellBtn} onClick={() => setCell(ri, ci, next(ARROW_CYCLE, c))} aria-label={c || "·"}>
                          {c === "up" ? <ArrowUpRight className="h-4 w-4" /> : c === "down" ? <ArrowDownRight className="h-4 w-4" /> : c === "flat" ? <ArrowRight className="h-4 w-4" /> : "·"}
                        </button>
                      ) : (
                        <input value={c} onChange={(e) => setCell(ri, ci, e.target.value)} className="h-8 w-[70px] rounded border bg-background px-1 text-center text-[13px]"
                          title={L("Valeur interdite : écrivez « gauche||droite », ex. -inf||+inf", "قيمة ممنوعة: اكتب «يسار||يمين»، مثلا ‎-inf||+inf", "Forbidden value: type “left||right”, e.g. -inf||+inf")} />
                      )}
                    </td>
                  ))}
                  <td className="ps-2">
                    <div className="flex items-center gap-0.5">
                      {r.type === "var" ? (
                        <button type="button" onClick={() => autoArrows(ri)} className="rounded p-1.5 hover:bg-muted" title={L("Flèches d'après le signe de f'(x)", "الأسهم حسب إشارة f'(x)", "Arrows from the sign of f'(x)")}><Wand2 className="h-4 w-4 text-[#2B579A]" /></button>
                      ) : ri > 0 ? (
                        <button type="button" onClick={() => autoProduct(ri)} className="rounded p-1.5 hover:bg-muted" title={L("Signe du produit / quotient des lignes au-dessus", "إشارة الجداء / الخارج للأسطر أعلاه", "Sign of the product / quotient of the rows above")}><Wand2 className="h-4 w-4 text-[#2B579A]" /></button>
                      ) : <span className="w-7" />}
                      <button type="button" onClick={() => moveRow(ri, -1)} className="rounded p-1 hover:bg-muted" aria-label="↑"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveRow(ri, 1)} className="rounded p-1 hover:bg-muted" aria-label="↓"><ChevronDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setD({ ...d, rows: d.rows.filter((_, i) => i !== ri) })} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label={L("Supprimer", "حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 flex gap-1.5 ps-1" dir={dir}>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[12px]" onClick={() => addRow("sign")}><Plus className="h-3.5 w-3.5" /> {L("Ligne de signes", "سطر الإشارة", "Sign row")}</Button>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[12px]" onClick={() => addRow("var")}><Plus className="h-3.5 w-3.5" /> {L("Ligne de variations", "سطر التغيرات", "Variation row")}</Button>
          </div>
        </div>

        <div>
          <div className="mb-1 text-[12px] font-medium text-muted-foreground">{L("Aperçu", "معاينة", "Preview")}</div>
          <div className="flex justify-center overflow-x-auto rounded-lg border bg-white p-3">
            <img src={preview} alt="" className="max-w-none" />
          </div>
        </div>
      </div>
    </MathOverlay>
  );
}
