import { useEffect, useMemo, useState } from "react";
import { Copy, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { db, fmtDate, fmtMoney, fromDateInput, PageTitle, toDateInput, useT } from "./adminShared";
import { useConfirm } from "./ConfirmDialog";

const selectCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";

interface Promo {
  code: string;
  kind: "percent" | "amount" | "days";
  value: number;
  plan_id: string | null;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
  description: string;
  isNew?: boolean;
}

const randomCode = () => Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

/** Codes promo (remise %, montant ou jours offerts) et parrainages des profs */
export default function AdminPromos() {
  const { L, lang } = useT();
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState<Promo | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"promo" | "referral">("promo");
  const { ask, dialog } = useConfirm();

  const load = async () => {
    const [{ data, error }, { data: p }, { data: t }] = await Promise.all([
      db.from("promo_codes").select("*").order("created_at", { ascending: false }),
      db.from("plans").select("id, name").order("sort_order"),
      db.rpc("admin_teachers"),
    ]);
    if (error) toast.error(error.message);
    setRows(data || []);
    setPlans(p || []);
    const m: Record<string, string> = {};
    (t || []).forEach((x: any) => (m[x.user_id] = x.name));
    setNames(m);
  };
  useEffect(() => {
    load();
  }, []);

  const promos = useMemo(() => rows.filter(r => !r.owner_id), [rows]);
  const referrals = useMemo(() => rows.filter(r => r.owner_id).sort((a, b) => b.used_count - a.used_count), [rows]);

  const valueLabel = (r: { kind: string; value: number }) =>
    r.kind === "percent" ? `-${Number(r.value)} %` : r.kind === "amount" ? `-${fmtMoney(r.value, lang)}` : L(`+${r.value} jours`, `+${r.value} يوما`, `+${r.value} days`);

  const save = async () => {
    if (!edit) return;
    const code = edit.code.trim().toUpperCase().replace(/\s+/g, "");
    if (code.length < 3 || !(edit.value > 0)) {
      toast.error(L("Code (3 caractères minimum) et valeur obligatoires", "الرمز (3 أحرف على الأقل) والقيمة إلزاميان", "Code (3+ characters) and value required"));
      return;
    }
    setSaving(true);
    const payload = {
      code, kind: edit.kind, value: edit.value, plan_id: edit.plan_id || null,
      max_uses: edit.max_uses || null, expires_at: edit.expires_at, is_active: edit.is_active, description: edit.description.trim() || null,
    };
    const { error } = edit.isNew
      ? await db.from("promo_codes").insert(payload)
      : await db.from("promo_codes").update(payload).eq("code", edit.code);
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? L("Ce code existe déjà", "هذا الرمز موجود", "This code already exists") : error.message);
      return;
    }
    setEdit(null);
    load();
  };

  const remove = (r: any) => ask({
    title: L(`Supprimer le code ${r.code} ?`, `حذف الرمز ${r.code}؟`, `Delete code ${r.code}?`),
    destructive: true,
    confirmLabel: L("Supprimer", "حذف", "Delete"),
    onConfirm: async () => {
      const { error } = await db.from("promo_codes").delete().eq("code", r.code);
      if (error) {
        toast.error(error.message);
        return false;
      }
      setRows(list => list.filter(x => x.code !== r.code));
    },
  });

  const toggle = async (r: any) => {
    const { error } = await db.from("promo_codes").update({ is_active: !r.is_active }).eq("code", r.code);
    if (error) toast.error(error.message);
    else setRows(list => list.map(x => (x.code === r.code ? { ...x, is_active: !r.is_active } : x)));
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => toast.success(L("Code copié", "تم نسخ الرمز", "Code copied")));
  };

  return (
    <div>
      <PageTitle
        title={L("Codes promo et parrainage", "رموز التخفيض والإحالة", "Promo codes & referrals")}
        subtitle={L(
          "Le professeur saisit le code en envoyant son reçu ; la remise s'applique à la validation du paiement.",
          "يدخل الأستاذ الرمز عند إرسال الوصل؛ يطبق التخفيض عند المصادقة على الأداء.",
          "Teachers enter the code when sending their receipt; the discount applies when the payment is approved."
        )}
        actions={tab === "promo" && (
          <Button className="gap-1.5" onClick={() => setEdit({ code: randomCode(), kind: "percent", value: 10, plan_id: null, max_uses: null, expires_at: null, is_active: true, description: "", isNew: true })}>
            <Plus className="h-4 w-4" />{L("Nouveau code", "رمز جديد", "New code")}
          </Button>
        )}
      />

      <div className="mb-3 inline-flex rounded-lg border p-0.5 text-sm">
        {(["promo", "referral"] as const).map(k => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 font-medium ${tab === k ? "bg-muted" : "text-muted-foreground"}`}>
            {k === "promo" ? L(`Codes promo (${promos.length})`, `رموز التخفيض (${promos.length})`, `Promo codes (${promos.length})`) : L(`Parrainages (${referrals.length})`, `الإحالات (${referrals.length})`, `Referrals (${referrals.length})`)}
          </button>
        ))}
      </div>

      {tab === "promo" ? (
        promos.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Gift className="mx-auto mb-2 h-6 w-6" />
            {L("Aucun code promo.", "لا توجد رموز تخفيض.", "No promo code.")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">{L("Code", "الرمز", "Code")}</th>
                  <th className="px-3 py-2 text-start">{L("Avantage", "الامتياز", "Benefit")}</th>
                  <th className="px-3 py-2 text-start">{L("Offre", "العرض", "Plan")}</th>
                  <th className="px-3 py-2 text-start">{L("Utilisations", "الاستعمالات", "Uses")}</th>
                  <th className="px-3 py-2 text-start">{L("Expire le", "ينتهي في", "Expires")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {promos.map(r => (
                  <tr key={r.code} className={r.is_active ? "" : "opacity-60"}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => copy(r.code)} className="inline-flex items-center gap-1 font-mono font-semibold hover:underline">{r.code}<Copy className="h-3 w-3" /></button>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    </td>
                    <td className="px-3 py-2">{valueLabel(r)}</td>
                    <td className="px-3 py-2">{r.plan_id ? plans.find(p => p.id === r.plan_id)?.name || "—" : L("Toutes", "الكل", "All")}</td>
                    <td className="px-3 py-2 tabular-nums">{r.used_count}{r.max_uses ? ` / ${r.max_uses}` : ""}</td>
                    <td className="px-3 py-2">{r.expires_at ? fmtDate(r.expires_at, lang) : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} aria-label={L("Actif", "مفعل", "Active")} />
                        <Button size="icon" variant="ghost" onClick={() => setEdit({ ...r, value: Number(r.value), description: r.description || "" })}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : referrals.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {L("Aucun professeur n'a encore partagé son code de parrainage.", "لم يشارك أي أستاذ رمز الإحالة بعد.", "No teacher has shared a referral code yet.")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">{L("Parrain", "المحيل", "Referrer")}</th>
                <th className="px-3 py-2 text-start">{L("Code", "الرمز", "Code")}</th>
                <th className="px-3 py-2 text-start">{L("Filleuls abonnés", "المحالون المشتركون", "Subscribed referrals")}</th>
                <th className="px-3 py-2 text-start">{L("Avantages", "الامتيازات", "Rewards")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {referrals.map(r => (
                <tr key={r.code} className={r.is_active ? "" : "opacity-60"}>
                  <td className="px-3 py-2 font-medium">{names[r.owner_id] || "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.code}</td>
                  <td className="px-3 py-2 tabular-nums">{r.used_count}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {L(`Filleul ${valueLabel(r)} · parrain +${r.referral_bonus_days || 0} j`, `المحال ${valueLabel(r)} · المحيل +${r.referral_bonus_days || 0} يوما`, `Referral ${valueLabel(r)} · referrer +${r.referral_bonus_days || 0} d`)}
                  </td>
                  <td className="px-3 py-2 text-end"><Switch checked={r.is_active} onCheckedChange={() => toggle(r)} aria-label={L("Actif", "مفعل", "Active")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{edit?.isNew ? L("Nouveau code promo", "رمز تخفيض جديد", "New promo code") : L("Modifier le code", "تعديل الرمز", "Edit code")}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pc-code">{L("Code", "الرمز", "Code")}</Label>
                <Input id="pc-code" value={edit.code} disabled={!edit.isNew} maxLength={32} className="font-mono uppercase" onChange={e => setEdit({ ...edit, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-kind">{L("Type", "النوع", "Type")}</Label>
                <select id="pc-kind" className={selectCls} value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value as Promo["kind"] })}>
                  <option value="percent">{L("Remise en %", "تخفيض بالنسبة", "Percent off")}</option>
                  <option value="amount">{L("Remise en MAD", "تخفيض بالدرهم", "Amount off (MAD)")}</option>
                  <option value="days">{L("Jours offerts", "أيام مجانية", "Free days")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-val">{edit.kind === "percent" ? "%" : edit.kind === "amount" ? "MAD" : L("Jours", "أيام", "Days")}</Label>
                <Input id="pc-val" type="number" min={1} max={edit.kind === "percent" ? 100 : undefined} value={edit.value || ""} onChange={e => setEdit({ ...edit, value: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pc-plan">{L("Offre concernée", "العرض المعني", "Plan")}</Label>
                <select id="pc-plan" className={selectCls} value={edit.plan_id || ""} onChange={e => setEdit({ ...edit, plan_id: e.target.value || null })}>
                  <option value="">{L("Toutes les offres", "كل العروض", "All plans")}</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-max">{L("Utilisations max (vide = illimité)", "الحد الأقصى (فارغ = بلا حد)", "Max uses (empty = unlimited)")}</Label>
                <Input id="pc-max" type="number" min={1} value={edit.max_uses || ""} onChange={e => setEdit({ ...edit, max_uses: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-exp">{L("Expire le", "ينتهي في", "Expires")}</Label>
                <Input id="pc-exp" type="date" value={toDateInput(edit.expires_at)} onChange={e => setEdit({ ...edit, expires_at: e.target.value ? fromDateInput(e.target.value, true) : null })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pc-desc">{L("Note interne", "ملاحظة داخلية", "Internal note")}</Label>
                <Input id="pc-desc" value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} placeholder={L("Rentrée 2026, salon…", "الدخول المدرسي، معرض…", "Back to school, fair…")} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={save} disabled={saving}>{saving ? L("Enregistrement…", "جار الحفظ…", "Saving…") : L("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
