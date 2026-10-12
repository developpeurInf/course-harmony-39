import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { ADMIN_PERMISSION_KEYS } from "@/lib/permissions";
import { adminInvoke, db, fmtDate, PageTitle, permLabel, useT } from "./adminShared";

const DELEGABLE = ADMIN_PERMISSION_KEYS.filter(k => k !== "admin.roles.manage");

export default function AdminTeam() {
  const { L, lang } = useT();
  const { user } = useAuth();
  const { adminCan } = useAccess();
  const canManage = adminCan("admin.roles.manage");
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data, error } = await db.rpc("admin_team");
    if (error) toast.error(error.message);
    setRows(data || []);
  };
  useEffect(() => {
    void load();
  }, []);

  const savePerms = async (row: any, perms: string[] | null, role = row.role) => {
    const { error } = await db.from("user_roles").update({ role, admin_permissions: role === "super_admin" ? null : perms }).eq("user_id", row.user_id);
    if (error) return toast.error(error.message);
    void load();
  };
  const remove = async (row: any) => {
    if (!confirm(L(`Retirer ${row.name} de l'équipe d'administration ?`, `إزالة ${row.name} من فريق الإدارة؟`, `Remove ${row.name} from the admin team?`))) return;
    const { error } = await db.from("user_roles").delete().eq("user_id", row.user_id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div>
      <PageTitle
        title={L("Équipe d'administration", "فريق الإدارة", "Admin team")}
        subtitle={L("Le super administrateur a tous les droits ; un administrateur n'a que les droits cochés.", "المسؤول الأعلى له كل الصلاحيات؛ المسؤول له فقط الصلاحيات المحددة.", "The super admin has every right; an admin only has the checked rights.")}
        actions={canManage && <Button className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{L("Ajouter", "إضافة", "Add")}</Button>}
      />
      <div className="space-y-3">
        {rows.map(r => {
          const self = r.user_id === user?.id;
          const all = r.admin_permissions === null;
          const perms: string[] = r.admin_permissions || [];
          return (
            <div key={r.user_id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{r.name}{self && <span className="text-xs font-normal text-muted-foreground"> · {L("vous", "أنت", "you")}</span>}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p>
                  <p className="text-xs text-muted-foreground">{L("Dernière connexion", "آخر دخول", "Last login")} {fmtDate(r.last_sign_in_at, lang)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={r.role}
                    disabled={!canManage || self}
                    onChange={e => savePerms(r, all ? null : perms, e.target.value)}
                  >
                    <option value="super_admin">{L("Super administrateur", "مسؤول أعلى", "Super admin")}</option>
                    <option value="admin">{L("Administrateur", "مسؤول", "Admin")}</option>
                  </select>
                  {canManage && !self && (
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(r)} aria-label="remove"><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
              {r.role === "admin" && (
                <div className="mt-3 border-t pt-3">
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" disabled={!canManage} checked={all} onChange={e => savePerms(r, e.target.checked ? null : [...DELEGABLE])} />
                    {L("Tous les droits (sauf l'équipe)", "كل الصلاحيات (باستثناء الفريق)", "All rights (except team)")}
                  </label>
                  {!all && (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {DELEGABLE.map(k => (
                        <label key={k} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={!canManage}
                            checked={perms.includes(k)}
                            onChange={e => savePerms(r, e.target.checked ? [...perms, k] : perms.filter(p => p !== k))}
                          />
                          {permLabel(k, lang)}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AddAdminDialog open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}

function AddAdminDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { L, lang } = useT();
  const [f, setF] = useState<any>({});
  const [perms, setPerms] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (open) {
      setF({ name: "", email: "", password: "", role: "admin" });
      setPerms(["admin.teachers.manage", "admin.subscriptions.manage", "admin.payments.manage"]);
      setResult(null);
      setCopied(false);
    }
  }, [open]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await adminInvoke("create_admin", { ...f, admin_permissions: f.role === "admin" ? perms : null });
    if (error) return toast.error(error);
    onSaved();
    if (data.password) setResult(`${f.email}\n${data.password}`);
    else {
      toast.success(L("Compte existant ajouté à l'équipe", "تمت إضافة الحساب الموجود إلى الفريق", "Existing account added to the team"));
      onOpenChange(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{L("Ajouter un membre", "إضافة عضو", "Add a member")}</DialogTitle>
          <DialogDescription>{L("Si l'e-mail correspond déjà à un compte, ce compte reçoit le rôle choisi.", "إذا كان البريد مرتبطا بحساب موجود، يحصل هذا الحساب على الدور المختار.", "If the email already has an account, it gets the chosen role.")}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-2">
            <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm" dir="ltr">{result}</pre>
            <Button variant="outline" className="gap-1.5" onClick={() => navigator.clipboard?.writeText(result).then(() => setCopied(true)).catch(() => undefined)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{L("Copier", "نسخ", "Copy")}
            </Button>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5"><Label>{L("Nom", "الاسم", "Name")}</Label><Input value={f.name || ""} onChange={e => setF({ ...f, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{L("E-mail", "البريد", "Email")} *</Label><Input required type="email" dir="ltr" value={f.email || ""} onChange={e => setF({ ...f, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{L("Mot de passe (vide = généré)", "كلمة المرور (فارغ = تلقائي)", "Password (empty = generated)")}</Label><Input dir="ltr" value={f.password || ""} onChange={e => setF({ ...f, password: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>{L("Rôle", "الدور", "Role")}</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
                <option value="admin">{L("Administrateur", "مسؤول", "Admin")}</option>
                <option value="super_admin">{L("Super administrateur", "مسؤول أعلى", "Super admin")}</option>
              </select>
            </div>
            {f.role === "admin" && (
              <div className="grid gap-1 rounded-lg border p-3 sm:grid-cols-2">
                {DELEGABLE.map(k => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={perms.includes(k)} onChange={e => setPerms(e.target.checked ? [...perms, k] : perms.filter(p => p !== k))} />
                    {permLabel(k, lang)}
                  </label>
                ))}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
              <Button type="submit">{L("Ajouter", "إضافة", "Add")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
