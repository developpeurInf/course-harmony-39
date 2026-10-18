import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { ADMIN_PERMISSION_KEYS } from "@/lib/permissions";
import { adminInvoke, copyWithToast, db, fmtDate, PageTitle, permLabel, useT } from "./adminShared";
import { useConfirm, type ConfirmOptions } from "./ConfirmDialog";

const DELEGABLE = ADMIN_PERMISSION_KEYS.filter(k => k !== "admin.roles.manage");

/** Case à cocher agrandie (zone de toucher ≥ 40 px) */
function CheckRow({ id, checked, disabled, onChange, children, className = "" }: {
  id: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; children: React.ReactNode; className?: string;
}) {
  return (
    <label htmlFor={id} className={`flex min-h-[40px] cursor-pointer items-center gap-3 rounded-md px-1 text-sm ${disabled ? "cursor-not-allowed opacity-70" : "hover:bg-muted/50"} ${className}`}>
      <input id={id} type="checkbox" className="h-5 w-5 flex-shrink-0 accent-primary" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

type Draft = { role: string; perms: string[] | null };
const sameDraft = (a: Draft, b: Draft) =>
  a.role === b.role && (a.role === "super_admin" || ((a.perms === null) === (b.perms === null) && (a.perms || []).slice().sort().join() === (b.perms || []).slice().sort().join()));

export default function AdminTeam() {
  const { L } = useT();
  const { user } = useAuth();
  const { adminCan } = useAccess();
  const canManage = adminCan("admin.roles.manage");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { ask, dialog: confirmDialog } = useConfirm();

  const load = async () => {
    const { data, error } = await db.rpc("admin_team");
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <PageTitle
        title={L("Équipe d'administration", "فريق الإدارة", "Admin team")}
        subtitle={L("Le super administrateur a tous les droits ; un administrateur n'a que les droits cochés.", "المسؤول الأعلى له كل الصلاحيات؛ المسؤول له فقط الصلاحيات المحددة.", "The super admin has every right; an admin only has the checked rights.")}
        actions={canManage && <Button className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{L("Ajouter", "إضافة", "Add")}</Button>}
      />
      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <TeamRow key={r.user_id} row={r} self={r.user_id === user?.id} canManage={canManage} ask={ask} onSaved={load} />
          ))}
        </div>
      )}
      <AddAdminDialog open={open} onOpenChange={setOpen} onSaved={load} ask={ask} />
      {confirmDialog}
    </div>
  );
}

function TeamRow({ row: r, self, canManage, ask, onSaved }: {
  row: any; self: boolean; canManage: boolean; ask: (o: ConfirmOptions) => void; onSaved: () => void;
}) {
  const { L, lang } = useT();
  const saved: Draft = { role: r.role, perms: r.admin_permissions === null || r.admin_permissions === undefined ? null : [...r.admin_permissions] };
  const [draft, setDraft] = useState<Draft>(saved);
  const [busy, setBusy] = useState(false);
  // rechargement : on repart de l'état enregistré
  useEffect(() => {
    setDraft({ role: r.role, perms: r.admin_permissions === null || r.admin_permissions === undefined ? null : [...r.admin_permissions] });
  }, [r.role, r.admin_permissions]);

  const dirty = !sameDraft(draft, saved);
  const editable = canManage && !self && !busy;
  const all = draft.perms === null;
  const perms = draft.perms || [];
  const uid = String(r.user_id).slice(0, 8);

  const write = async () => {
    setBusy(true);
    const { error } = await db.from("user_roles")
      .update({ role: draft.role, admin_permissions: draft.role === "super_admin" ? null : draft.perms })
      .eq("user_id", r.user_id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(L("Droits enregistrés", "تم حفظ الصلاحيات", "Rights saved"));
    onSaved();
    return true;
  };

  const save = () => {
    if (draft.role === "super_admin" && r.role !== "super_admin") {
      ask({
        title: L(`Nommer ${r.name} super administrateur ?`, `تعيين ${r.name} مسؤولا أعلى؟`, `Make ${r.name} a super admin?`),
        description: L(
          "Il aura tous les droits, y compris la gestion de l'équipe d'administration.",
          "سيحصل على كل الصلاحيات، بما فيها تسيير فريق الإدارة.",
          "They will have every right, including managing the admin team."
        ),
        confirmLabel: L("Nommer", "تعيين", "Promote"),
        destructive: true,
        onConfirm: write,
      });
    } else void write();
  };

  const remove = () => ask({
    title: L(`Retirer ${r.name} de l'équipe d'administration ?`, `إزالة ${r.name} من فريق الإدارة؟`, `Remove ${r.name} from the admin team?`),
    description: L("Il perdra l'accès à l'espace d'administration.", "سيفقد الولوج إلى فضاء الإدارة.", "They will lose access to the administration area."),
    confirmLabel: L("Retirer", "إزالة", "Remove"),
    destructive: true,
    onConfirm: async () => {
      const { error } = await db.from("user_roles").delete().eq("user_id", r.user_id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success(L("Membre retiré", "تمت إزالة العضو", "Member removed"));
      onSaved();
    },
  });

  return (
    <div className={`rounded-xl border bg-card p-4 ${dirty ? "border-amber-400 ring-1 ring-amber-300" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{r.name}{self && <span className="text-xs font-normal text-muted-foreground"> · {L("vous", "أنت", "you")}</span>}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p>
          <p className="text-xs text-muted-foreground">{L("Dernière connexion", "آخر دخول", "Last login")} {fmtDate(r.last_sign_in_at, lang)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label={`${L("Rôle", "الدور", "Role")} · ${r.name}`}
            value={draft.role}
            disabled={!editable}
            onChange={e => {
              const role = e.target.value;
              // passage super admin → admin : on repart de « tous les droits » (sauf l'équipe)
              setDraft(d => ({ role, perms: role === "admin" ? (r.role === "admin" ? saved.perms : d.perms ?? null) : null }));
            }}
          >
            <option value="super_admin">{L("Super administrateur", "مسؤول أعلى", "Super admin")}</option>
            <option value="admin">{L("Administrateur", "مسؤول", "Admin")}</option>
          </select>
          {canManage && !self && (
            <Button size="icon" variant="ghost" className="h-10 w-10 text-red-600" onClick={remove} disabled={busy}
              aria-label={L(`Retirer ${r.name}`, `إزالة ${r.name}`, `Remove ${r.name}`)} title={L("Retirer", "إزالة", "Remove")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {draft.role === "admin" && (
        <div className="mt-3 border-t pt-3">
          <CheckRow
            id={`team-${uid}-all`}
            className="mb-1 font-medium"
            disabled={!editable}
            checked={all}
            onChange={v => setDraft(d => ({ ...d, perms: v ? null : [...DELEGABLE] }))}
          >
            {L("Tous les droits (sauf l'équipe)", "كل الصلاحيات (باستثناء الفريق)", "All rights (except team)")}
          </CheckRow>
          {!all && (
            <div className="grid gap-x-3 sm:grid-cols-2">
              {DELEGABLE.map(k => (
                <CheckRow
                  key={k}
                  id={`team-${uid}-${k}`}
                  disabled={!editable}
                  checked={perms.includes(k)}
                  onChange={v => setDraft(d => ({ ...d, perms: v ? [...(d.perms || []), k] : (d.perms || []).filter(p => p !== k) }))}
                >
                  {permLabel(k, lang)}
                </CheckRow>
              ))}
            </div>
          )}
        </div>
      )}
      {dirty && canManage && !self && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{L("Modifications non enregistrées", "تعديلات غير محفوظة", "Unsaved changes")}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft(saved)}>
              <XCircle className="h-4 w-4" />{L("Annuler", "إلغاء", "Cancel")}
            </Button>
            <Button size="sm" disabled={busy} onClick={save}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {busy ? L("Enregistrement…", "جار الحفظ…", "Saving…") : L("Enregistrer", "حفظ", "Save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddAdminDialog({ open, onOpenChange, onSaved, ask }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; ask: (o: ConfirmOptions) => void }) {
  const { L, lang } = useT();
  const [f, setF] = useState<any>({});
  const [perms, setPerms] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setF({ name: "", email: "", password: "", role: "admin" });
      setPerms(["admin.teachers.manage", "admin.subscriptions.manage", "admin.payments.manage"]);
      setResult(null);
      setCopied(false);
    }
  }, [open]);
  const create = async () => {
    setSaving(true);
    const { data, error } = await adminInvoke("create_admin", { ...f, admin_permissions: f.role === "admin" ? perms : null });
    setSaving(false);
    if (error) {
      toast.error(error);
      return false;
    }
    onSaved();
    if (data.password) setResult(`${f.email}\n${data.password}`);
    else {
      toast.success(L("Compte existant ajouté à l'équipe", "تمت إضافة الحساب الموجود إلى الفريق", "Existing account added to the team"));
      onOpenChange(false);
    }
    return true;
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.role === "super_admin") {
      ask({
        title: L("Créer un super administrateur ?", "إنشاء مسؤول أعلى؟", "Create a super admin?"),
        description: L("Il aura tous les droits, y compris la gestion de l'équipe d'administration.", "سيحصل على كل الصلاحيات، بما فيها تسيير فريق الإدارة.", "They will have every right, including managing the admin team."),
        confirmLabel: L("Créer", "إنشاء", "Create"),
        destructive: true,
        onConfirm: create,
      });
    } else void create();
  };
  return (
    <Dialog open={open} onOpenChange={v => !saving && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{L("Ajouter un membre", "إضافة عضو", "Add a member")}</DialogTitle>
          <DialogDescription>{L("Si l'e-mail correspond déjà à un compte, ce compte reçoit le rôle choisi.", "إذا كان البريد مرتبطا بحساب موجود، يحصل هذا الحساب على الدور المختار.", "If the email already has an account, it gets the chosen role.")}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-2">
            <pre className="select-all whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm" dir="ltr">{result}</pre>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5" onClick={async () => { if (await copyWithToast(result, L)) setCopied(true); }}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? L("Copié", "تم النسخ", "Copied") : L("Copier", "نسخ", "Copy")}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>{L("Terminer", "إنهاء", "Done")}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="add-admin-name">{L("Nom", "الاسم", "Name")}</Label><Input id="add-admin-name" value={f.name || ""} onChange={e => setF({ ...f, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="add-admin-email">{L("E-mail", "البريد", "Email")} *</Label><Input id="add-admin-email" required type="email" dir="ltr" value={f.email || ""} onChange={e => setF({ ...f, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="add-admin-password">{L("Mot de passe (vide = généré)", "كلمة المرور (فارغ = تلقائي)", "Password (empty = generated)")}</Label><Input id="add-admin-password" dir="ltr" value={f.password || ""} onChange={e => setF({ ...f, password: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="add-admin-role">{L("Rôle", "الدور", "Role")}</Label>
              <select id="add-admin-role" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
                <option value="admin">{L("Administrateur", "مسؤول", "Admin")}</option>
                <option value="super_admin">{L("Super administrateur", "مسؤول أعلى", "Super admin")}</option>
              </select>
            </div>
            {f.role === "admin" && (
              <fieldset className="grid gap-x-3 rounded-lg border p-2 sm:grid-cols-2">
                <legend className="px-1 text-sm font-medium">{L("Droits", "الصلاحيات", "Rights")}</legend>
                {DELEGABLE.map(k => (
                  <CheckRow key={k} id={`add-admin-${k}`} checked={perms.includes(k)} onChange={v => setPerms(v ? [...perms, k] : perms.filter(p => p !== k))}>
                    {permLabel(k, lang)}
                  </CheckRow>
                ))}
              </fieldset>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{L("Annuler", "إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {L("Ajouter", "إضافة", "Add")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
