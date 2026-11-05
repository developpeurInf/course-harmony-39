"use client";

/**
 * Changer les nombres d'un énoncé (texte + équations) : un par un ou au hasard,
 * dans le document ou dans une copie (« Sujet B »).
 */
import { useEffect, useState } from "react";
import { Copy, Dices, Hash } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import type { Tr } from "../../shared/useOfficeEnv";
import { MathOverlay } from "./MathOverlay";
import { randomLike, scanNumbers, type NumberInfo } from "./numbers";

export function NumbersDialog({
  open, editor, onClose, onApply, L, dir,
}: {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
  /** copy = true : appliquer dans une copie du document */
  onApply: (repl: Record<string, string>, copy: boolean) => void;
  L: Tr;
  dir: "ltr" | "rtl";
}) {
  const [items, setItems] = useState<NumberInfo[]>([]);
  const [repl, setRepl] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [scopeSel, setScopeSel] = useState(false);

  useEffect(() => {
    if (!open || !editor) return;
    setItems(scanNumbers(editor));
    setRepl({});
    setChecked({});
    setScopeSel(!editor.state.selection.empty);
  }, [open, editor]);

  const randomize = (keys: string[]) => setRepl((r) => {
    const out = { ...r };
    keys.forEach((k) => (out[k] = randomLike(k)));
    return out;
  });
  const ticked = items.filter((i) => checked[i.value]).map((i) => i.value);
  const changes = Object.keys(repl).filter((k) => repl[k] && repl[k] !== k).length;

  return (
    <MathOverlay
      open={open}
      onClose={onClose}
      dir={dir}
      className="max-w-2xl"
      icon={<Hash className="h-4 w-4" />}
      title={L("Changer les nombres de l'énoncé", "تغيير أعداد النص", "Change the numbers")}
      subtitle={scopeSel
        ? L("Nombres trouvés dans la sélection (texte et équations).", "الأعداد الموجودة في التحديد (النص والمعادلات).", "Numbers found in the selection (text and equations).")
        : L("Nombres trouvés dans tout le document (texte et équations). Sélectionnez un exercice avant d'ouvrir cette fenêtre pour ne changer que lui.", "الأعداد الموجودة في كل المستند. حدد تمرينا قبل فتح هذه النافذة لتغييره وحده.", "Numbers found in the whole document. Select one exercise first to change only that one.")}
      footer={
        <>
          <span className="me-auto text-[12px] text-muted-foreground">{changes} {L("nombre(s) à remplacer", "عدد(أعداد) للتعويض", "number(s) to replace")}</span>
          <Button variant="outline" size="sm" onClick={onClose}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button variant="outline" size="sm" disabled={!changes} onClick={() => onApply(repl, true)} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> {L("Créer un sujet B (copie)", "إنشاء موضوع B (نسخة)", "Create version B (copy)")}
          </Button>
          <Button size="sm" disabled={!changes} onClick={() => onApply(repl, false)} className="bg-[#2B579A] text-white hover:bg-[#244a85]">
            {L("Appliquer ici", "تطبيق هنا", "Apply here")}
          </Button>
        </>
      }
    >
      <div className="space-y-2 p-3 sm:p-4">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{L("Aucun nombre trouvé.", "لم يتم العثور على أي عدد.", "No numbers found.")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[12px]">
                <input type="checkbox" className="accent-[#2B579A]" checked={ticked.length === items.length} onChange={(e) => setChecked(Object.fromEntries(items.map((i) => [i.value, e.target.checked])))} />
                {L("Tout cocher", "تحديد الكل", "Select all")}
              </label>
              <Button type="button" size="sm" variant="outline" className="ms-auto h-7 gap-1.5 text-[12px]" disabled={!ticked.length} onClick={() => randomize(ticked)}>
                <Dices className="h-3.5 w-3.5" /> {L("Tirer au hasard les nombres cochés", "اختيار عشوائي للأعداد المحددة", "Randomize ticked numbers")}
              </Button>
            </div>
            <div className="divide-y rounded-lg border">
              {items.map((it) => (
                <div key={it.value} className="flex items-center gap-2 px-2 py-1.5">
                  <input type="checkbox" className="accent-[#2B579A]" checked={!!checked[it.value]} onChange={(e) => setChecked((c) => ({ ...c, [it.value]: e.target.checked }))} aria-label={it.value} />
                  <span className="w-16 shrink-0 text-end font-mono text-[14px] font-semibold" dir="ltr">{it.value}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">×{it.count}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" dir="ltr" title={it.sample}>{it.sample}</span>
                  <span className="text-muted-foreground">→</span>
                  <input value={repl[it.value] ?? ""} onChange={(e) => setRepl((r) => ({ ...r, [it.value]: e.target.value.trim() }))} placeholder={it.value} dir="ltr"
                    className="h-7 w-20 rounded border bg-background px-1.5 text-center font-mono text-[13px]" aria-label={L("Nouvelle valeur", "القيمة الجديدة", "New value")} />
                  <button type="button" onClick={() => randomize([it.value])} className="rounded p-1 hover:bg-muted" title={L("Au hasard", "عشوائيا", "Random")}><Dices className="h-4 w-4 text-[#2B579A]" /></button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{L("Astuce : les exposants (x²) et les numéros d'exercice sont aussi des nombres, ne les cochez pas. Ctrl+Z annule.", "نصيحة: الأسس (x²) وأرقام التمارين أعداد أيضا، لا تحددها. Ctrl+Z للتراجع.", "Tip: exponents (x²) and exercise numbers are numbers too, leave them unticked. Ctrl+Z undoes.")}</p>
          </>
        )}
      </div>
    </MathOverlay>
  );
}
