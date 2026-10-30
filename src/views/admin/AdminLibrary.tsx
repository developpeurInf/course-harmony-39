import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { kindLabel, LibraryPreview } from "@/components/library/LibraryShared";
import { db, fmtDate, PageTitle, useT } from "./adminShared";
import { cn } from "@/lib/utils";

/** Validation de la bibliothèque partagée */
export default function AdminLibrary() {
  const { L, lang } = useT();
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<any[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<any>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    let q = db.from("library_items").select("*").order("created_at", { ascending: false }).limit(300);
    if (status !== "all") q = q.eq("status", status);
    q.then(async ({ data, error }: any) => {
      if (error) {
        setError(error.message);
        setItems([]);
        return;
      }
      setItems(data || []);
      const ids = [...new Set((data || []).map((t: any) => t.owner_id))];
      if (ids.length) {
        const { data: p } = await db.from("profiles").select("id, name").in("id", ids);
        const m: Record<string, string> = {};
        (p || []).forEach((x: any) => (m[x.id] = x.name));
        setNames(m);
      }
    });
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (approve: boolean) => {
    if (!current) return;
    const { error } = await db.rpc("library_review", { p_item: current.id, p_approve: approve, p_note: note });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? L("Publié dans la bibliothèque", "تم النشر في المكتبة", "Published to the library") : L("Refusé", "مرفوض", "Rejected"));
    setCurrent(null);
    setNote("");
    load();
  };

  return (
    <div>
      <PageTitle title={L("Bibliothèque partagée", "المكتبة المشتركة", "Shared library")} subtitle={L("Contenus proposés par les professeurs : validez-les avant qu'ils soient visibles par tous.", "محتويات يقترحها الأساتذة: صادق عليها قبل أن تصبح مرئية للجميع.", "Content proposed by teachers: review it before everyone can see it.")}
        actions={
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label={L("Statut", "الحالة", "Status")}>
            <option value="pending">{L("À valider", "للمصادقة", "To review")}</option>
            <option value="approved">{L("Publiés", "منشورة", "Published")}</option>
            <option value="rejected">{L("Refusés", "مرفوضة", "Rejected")}</option>
            <option value="all">{L("Tous", "الكل", "All")}</option>
          </select>
        } />
      {error && <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{L("Appliquez la migration 20261107090000.", "طبّق الترحيل 20261107090000.", "Apply migration 20261107090000.")} ({error})</p>}
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <ul className="space-y-1.5">
          {(items || []).length === 0 && <li className="text-sm text-muted-foreground">{L("Rien à afficher.", "لا شيء للعرض.", "Nothing to show.")}</li>}
          {(items || []).map(i => (
            <li key={i.id}>
              <button type="button" onClick={() => { setCurrent(i); setNote(i.review_note || ""); }} className={cn("w-full rounded-lg border bg-card px-3 py-2 text-start text-sm hover:bg-muted", current?.id === i.id && "border-primary")}>
                <span className="block truncate font-medium">{i.title}</span>
                <span className="text-xs text-muted-foreground">{kindLabel(i.kind, L)} · {names[i.owner_id] || "—"} · {fmtDate(i.created_at, lang)} · {L(`${i.imports} import(s)`, `${i.imports} استيراد`, `${i.imports} import(s)`)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-3 rounded-xl border bg-card p-4">
          {current ? (
            <>
              <div>
                <h2 className="font-semibold">{current.title}</h2>
                <p className="text-xs text-muted-foreground">{kindLabel(current.kind, L)}{current.level ? ` · ${current.level}` : ""}</p>
                {current.description && <p className="mt-1 text-sm">{current.description}</p>}
              </div>
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border p-3"><LibraryPreview item={current} tr={L} /></div>
              <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={L("Note pour l'auteur (facultatif)", "ملاحظة للمؤلف (اختياري)", "Note for the author (optional)")} aria-label={L("Note", "ملاحظة", "Note")} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-1.5" onClick={() => review(false)}><X className="h-4 w-4" />{L("Refuser", "رفض", "Reject")}</Button>
                <Button className="gap-1.5" onClick={() => review(true)}><Check className="h-4 w-4" />{L("Publier", "نشر", "Publish")}</Button>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">{L("Choisissez un contenu.", "اختر محتوى.", "Pick an item.")}</p>}
        </div>
      </div>
    </div>
  );
}
