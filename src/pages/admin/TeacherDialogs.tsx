import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminInvoke, db, useT } from "./adminShared";
import type { ConfirmOptions } from "./ConfirmDialog";

/** Dialogues communs à la liste des professeurs et à la fiche professeur */

export function EditTeacherDialog({ open, onOpenChange, teacher, account: accountProp, onSaved }: any) {
  const { L } = useT();
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<any>(accountProp || null);
  // depuis la liste, la fiche complète (notes…) est chargée à l'ouverture
  useEffect(() => {
    if (!open) return;
    if (accountProp) setAccount(accountProp);
    else db.from("teacher_accounts").select("*").eq("user_id", teacher.user_id).maybeSingle().then(({ data }: any) => setAccount(data || {}));
  }, [open, accountProp, teacher]);
  useEffect(() => {
    if (open) setF({
      name: teacher.name || "", email: teacher.email || "", phone: account?.phone || "", school: account?.school || "",
      city: account?.city || "", subject: account?.subject || "", notes: account?.notes || "",
    });
  }, [open, teacher, account]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await adminInvoke("update_teacher", {
      user_id: teacher.user_id, ...f, email: f.email !== teacher.email ? f.email : undefined,
    });
    setSaving(false);
    if (error) return toast.error(error);
    toast.success(L("Enregistré", "تم الحفظ", "Saved"));
    onOpenChange(false);
    onSaved();
  };
  const field = (k: string, label: string, props: any = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`edit-teacher-${k}`}>{label}</Label>
      <Input id={`edit-teacher-${k}`} value={f[k] || ""} onChange={e => setF({ ...f, [k]: e.target.value })} {...props} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{L("Modifier le professeur", "تعديل الأستاذ", "Edit teacher")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", L("Nom complet", "الاسم الكامل", "Full name"), { required: true })}
            {field("email", L("E-mail", "البريد", "Email"), { type: "email", dir: "ltr", required: true })}
            {field("phone", L("Téléphone", "الهاتف", "Phone"), { dir: "ltr" })}
            {field("subject", L("Matière", "المادة", "Subject"))}
            {field("school", L("Établissement", "المؤسسة", "School"))}
            {field("city", L("Ville", "المدينة", "City"))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-teacher-notes">{L("Notes internes", "ملاحظات داخلية", "Internal notes")}</Label>
            <Textarea id="edit-teacher-notes" rows={3} value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? L("Enregistrement…", "جار الحفظ…", "Saving…") : L("Enregistrer", "حفظ", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/** Suspendre / réactiver : options du ConfirmDialog (motif facultatif à la suspension, confirmation à la réactivation) */
export function suspensionConfirm(
  teacher: { user_id: string; name?: string; account_status?: string },
  L: (fr: string, ar: string, en: string) => string,
  onDone: () => void
): ConfirmOptions {
  const suspended = teacher.account_status === "suspended";
  const name = teacher.name || "";
  return {
    title: suspended
      ? L(`Réactiver ${name} ?`, `إعادة تفعيل ${name}؟`, `Reactivate ${name}?`)
      : L(`Suspendre ${name} ?`, `توقيف ${name}؟`, `Suspend ${name}?`),
    description: suspended
      ? L("Le professeur pourra de nouveau se connecter.", "سيتمكن الأستاذ من الدخول من جديد.", "The teacher will be able to log in again.")
      : L("Le professeur ne pourra plus se connecter tant que le compte est suspendu (réversible).", "لن يتمكن الأستاذ من الدخول ما دام الحساب موقوفا (قابل للتراجع).", "The teacher can no longer log in while suspended (reversible)."),
    confirmLabel: suspended ? L("Réactiver", "إعادة التفعيل", "Reactivate") : L("Suspendre", "توقيف", "Suspend"),
    destructive: !suspended,
    input: suspended ? undefined : {
      label: L("Motif de la suspension (facultatif)", "سبب التوقيف (اختياري)", "Reason (optional)"),
      multiline: true,
    },
    onConfirm: async (reason: string) => {
      const ok = await setTeacherSuspension(teacher, !suspended, reason, L);
      if (ok) onDone();
      return ok;
    },
  };
}

/** Appel serveur : suspend (true) ou réactive (false) */
export async function setTeacherSuspension(
  teacher: { user_id: string },
  suspend: boolean,
  reason: string,
  L: (fr: string, ar: string, en: string) => string
): Promise<boolean> {
  const { error } = await adminInvoke("set_status", { user_id: teacher.user_id, status: suspend ? "suspended" : "active", reason: suspend ? reason : "" });
  if (error) {
    toast.error(error);
    return false;
  }
  toast.success(suspend ? L("Compte suspendu : il ne peut plus se connecter", "تم توقيف الحساب: لم يعد بإمكانه الدخول", "Account suspended: login blocked") : L("Compte réactivé", "تم تفعيل الحساب", "Account reactivated"));
  return true;
}

/** Suppression définitive du compte : le professeur ne peut plus se connecter */
export function DeleteTeacherDialog({ teacher, onClose, onDeleted }: { teacher: any | null; onClose: () => void; onDeleted: () => void }) {
  const { L } = useT();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setTyped(""), [teacher]);
  if (!teacher) return null;
  const ok = typed.trim().toLowerCase() === String(teacher.name || "").trim().toLowerCase();
  const run = async () => {
    setBusy(true);
    const { error } = await adminInvoke("delete_teacher", { user_id: teacher.user_id });
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(L("Professeur supprimé", "تم حذف الأستاذ", "Teacher deleted"));
    onClose();
    onDeleted();
  };
  return (
    <Dialog open={!!teacher} onOpenChange={v => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {L("Supprimer ce professeur ?", "حذف هذا الأستاذ؟", "Delete this teacher?")}
          </DialogTitle>
          <DialogDescription>
            {L(
              `Le compte de ${teacher.name} est supprimé : il ne pourra plus se connecter et disparaît de la liste. Ses classes, cours et élèves restent enregistrés (aucune donnée effacée). L'adresse e-mail pourra être réutilisée pour un nouveau compte.`,
              `يُحذف حساب ${teacher.name}: لن يتمكن من الدخول ويختفي من القائمة. تبقى أقسامه ودروسه وتلاميذه محفوظة. يمكن إعادة استعمال البريد لحساب جديد.`,
              `${teacher.name}'s account is deleted: login is blocked and it disappears from the list. Classes, courses and students are kept. The email can be reused.`
            )}
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {L("Pour bloquer l'accès sans supprimer, utilisez plutôt « Suspendre » (réversible).", "لمنع الدخول دون حذف، استعمل « توقيف » (قابل للتراجع).", "To block access without deleting, use “Suspend” (reversible).")}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="delete-teacher-confirm" className="text-xs">{L("Tapez le nom du professeur pour confirmer :", "اكتب اسم الأستاذ للتأكيد:", "Type the teacher's name to confirm:")} <b>{teacher.name}</b></Label>
          <Input id="delete-teacher-confirm" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" disabled={busy} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" disabled={!ok || busy} onClick={run}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? L("Suppression…", "جار الحذف…", "Deleting…") : L("Supprimer définitivement", "حذف نهائي", "Delete permanently")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
