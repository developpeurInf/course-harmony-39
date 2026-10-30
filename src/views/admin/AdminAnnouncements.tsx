import { useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db, fmtDate, fromDateInput, PageTitle, toDateInput, useT } from "./adminShared";
import { useConfirm } from "./ConfirmDialog";

const selectCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export const ANNOUNCEMENT_TONE: Record<string, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  danger: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
};

interface Ann {
  id?: string;
  title: string;
  body: string;
  level: string;
  audience: string;
  plan_id: string | null;
  link_url: string;
  link_label: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

const empty = (): Ann => ({
  title: "", body: "", level: "info", audience: "teachers", plan_id: null, link_url: "", link_label: "",
  starts_at: new Date().toISOString(), ends_at: null, is_active: true,
});

/** Annonces affichées en bandeau en haut de l'application */
export default function AdminAnnouncements() {
  const { L, lang } = useT();
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [edit, setEdit] = useState<Ann | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { ask, dialog } = useConfirm();

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: p }] = await Promise.all([
      db.from("announcements").select("*").order("starts_at", { ascending: false }),
      db.from("plans").select("id, name").order("sort_order"),
    ]);
    if (error) toast.error(error.message);
    setRows(data || []);
    setPlans(p || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const audienceLabel = (a: string) =>
    a === "teachers" ? L("Professeurs", "الأساتذة", "Teachers") : a === "students" ? L("Élèves", "التلاميذ", "Students") : L("Tout le monde", "الجميع", "Everyone");

  const status = (r: any) => {
    const now = Date.now();
    if (!r.is_active) return L("Désactivée", "معطلة", "Disabled");
    if (new Date(r.starts_at).getTime() > now) return L("Programmée", "مبرمجة", "Scheduled");
    if (r.ends_at && new Date(r.ends_at).getTime() <= now) return L("Terminée", "منتهية", "Ended");
    return L("En ligne", "منشورة", "Live");
  };

  const save = async () => {
    if (!edit || !edit.title.trim()) return;
    setSaving(true);
    const payload = {
      title: edit.title.trim(), body: edit.body.trim() || null, level: edit.level, audience: edit.audience,
      plan_id: edit.plan_id || null, link_url: edit.link_url.trim() || null, link_label: edit.link_label.trim() || null,
      starts_at: edit.starts_at, ends_at: edit.ends_at, is_active: edit.is_active,
    };
    const { error } = edit.id
      ? await db.from("announcements").update(payload).eq("id", edit.id)
      : await db.from("announcements").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(L("Annonce enregistrée", "تم حفظ الإعلان", "Announcement saved"));
    setEdit(null);
    load();
  };

  const remove = (r: any) => ask({
    title: L("Supprimer cette annonce ?", "حذف هذا الإعلان؟", "Delete this announcement?"),
    description: r.title,
    destructive: true,
    confirmLabel: L("Supprimer", "حذف", "Delete"),
    onConfirm: async () => {
      const { error } = await db.from("announcements").delete().eq("id", r.id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      setRows(list => list.filter(x => x.id !== r.id));
    },
  });

  const toggle = async (r: any) => {
    const { error } = await db.from("announcements").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message);
    else setRows(list => list.map(x => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)));
  };

  return (
    <div>
      <PageTitle
        title={L("Annonces", "الإعلانات", "Announcements")}
        subtitle={L(
          "Un bandeau en haut de l'application : nouveauté, maintenance, promotion…",
          "شريط في أعلى التطبيق: جديد، صيانة، عرض ترويجي…",
          "A banner at the top of the app: news, maintenance, promotion…"
        )}
        actions={<Button className="gap-1.5" onClick={() => setEdit(empty())}><Plus className="h-4 w-4" />{L("Nouvelle annonce", "إعلان جديد", "New announcement")}</Button>}
      />

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-2 h-6 w-6" />
          {L("Aucune annonce pour le moment.", "لا توجد إعلانات حاليا.", "No announcement yet.")}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className={`rounded-xl border p-3 ${ANNOUNCEMENT_TONE[r.level] || ANNOUNCEMENT_TONE.info}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{r.title}</p>
                  {r.body && <p className="mt-0.5 whitespace-pre-line text-sm opacity-90">{r.body}</p>}
                  <p className="mt-1 text-xs opacity-75">
                    {status(r)} · {audienceLabel(r.audience)}
                    {r.plan_id ? ` · ${plans.find(p => p.id === r.plan_id)?.name || ""}` : ""}
                    {` · ${fmtDate(r.starts_at, lang)}`}{r.ends_at ? ` → ${fmtDate(r.ends_at, lang)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} aria-label={L("Activer", "تفعيل", "Enable")} />
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ ...r, body: r.body || "", link_url: r.link_url || "", link_label: r.link_label || "" })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? L("Modifier l'annonce", "تعديل الإعلان", "Edit announcement") : L("Nouvelle annonce", "إعلان جديد", "New announcement")}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ann-title">{L("Titre", "العنوان", "Title")}</Label>
                <Input id="ann-title" value={edit.title} maxLength={120} onChange={e => setEdit({ ...edit, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-body">{L("Message", "الرسالة", "Message")}</Label>
                <Textarea id="ann-body" rows={3} value={edit.body} maxLength={600} onChange={e => setEdit({ ...edit, body: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ann-level">{L("Couleur", "اللون", "Color")}</Label>
                  <select id="ann-level" className={selectCls} value={edit.level} onChange={e => setEdit({ ...edit, level: e.target.value })}>
                    <option value="info">{L("Information (bleu)", "معلومة (أزرق)", "Info (blue)")}</option>
                    <option value="success">{L("Nouveauté (vert)", "جديد (أخضر)", "News (green)")}</option>
                    <option value="warning">{L("Attention (orange)", "تنبيه (برتقالي)", "Warning (orange)")}</option>
                    <option value="danger">{L("Important (rouge)", "مهم (أحمر)", "Important (red)")}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-aud">{L("Destinataires", "المستهدفون", "Audience")}</Label>
                  <select id="ann-aud" className={selectCls} value={edit.audience} onChange={e => setEdit({ ...edit, audience: e.target.value })}>
                    <option value="teachers">{L("Professeurs", "الأساتذة", "Teachers")}</option>
                    <option value="students">{L("Élèves", "التلاميذ", "Students")}</option>
                    <option value="all">{L("Tout le monde", "الجميع", "Everyone")}</option>
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ann-plan">{L("Seulement pour une offre", "لعرض معين فقط", "Only for a plan")}</Label>
                  <select id="ann-plan" className={selectCls} value={edit.plan_id || ""} onChange={e => setEdit({ ...edit, plan_id: e.target.value || null })}>
                    <option value="">{L("Toutes les offres", "كل العروض", "All plans")}</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-start">{L("Début", "البداية", "Start")}</Label>
                  <Input id="ann-start" type="date" value={toDateInput(edit.starts_at)} onChange={e => setEdit({ ...edit, starts_at: fromDateInput(e.target.value) || new Date().toISOString() })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-end">{L("Fin (vide = sans fin)", "النهاية (فارغ = بدون نهاية)", "End (empty = none)")}</Label>
                  <Input id="ann-end" type="date" value={toDateInput(edit.ends_at)} onChange={e => setEdit({ ...edit, ends_at: e.target.value ? fromDateInput(e.target.value, true) : null })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-link">{L("Lien (facultatif)", "رابط (اختياري)", "Link (optional)")}</Label>
                  <Input id="ann-link" placeholder="/subscription" value={edit.link_url} onChange={e => setEdit({ ...edit, link_url: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-link-l">{L("Texte du lien", "نص الرابط", "Link text")}</Label>
                  <Input id="ann-link-l" value={edit.link_label} onChange={e => setEdit({ ...edit, link_label: e.target.value })} />
                </div>
              </div>
              {edit.title && (
                <div className={`rounded-lg border p-3 text-sm ${ANNOUNCEMENT_TONE[edit.level]}`}>
                  <p className="font-semibold">{edit.title}</p>
                  {edit.body && <p className="whitespace-pre-line opacity-90">{edit.body}</p>}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={save} disabled={saving || !edit?.title.trim()}>{saving ? L("Enregistrement…", "جار الحفظ…", "Saving…") : L("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
