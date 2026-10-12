import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, fmtDate, PageTitle, permLabel, useT } from "./adminShared";

/** Libellé lisible d'une ligne du journal */
function describe(row: any, L: (fr: string, ar: string, en: string) => string, lang: "fr" | "ar" | "en") {
  const n = row.new_data || {};
  const o = row.old_data || {};
  const t = row.table_name;
  const a = row.action;
  switch (a) {
    case "create_teacher": return L(`Création du compte ${n.email || ""}`, `إنشاء الحساب ${n.email || ""}`, `Account created ${n.email || ""}`);
    case "reset_password": return L("Nouveau mot de passe provisoire", "كلمة مرور مؤقتة جديدة", "New temporary password");
    case "suspend_teacher": return L(`Compte suspendu${n.reason ? ` (${n.reason})` : ""}`, "توقيف الحساب", "Account suspended");
    case "reactivate_teacher": return L("Compte réactivé", "إعادة تفعيل الحساب", "Account reactivated");
    case "update_teacher": return L("Informations modifiées", "تعديل المعلومات", "Details updated");
    case "create_admin": return L(`Ajout à l'équipe admin (${n.role})`, "إضافة إلى فريق الإدارة", "Added to admin team");
  }
  const verb = a === "insert" ? L("ajout", "إضافة", "added") : a === "delete" ? L("suppression", "حذف", "removed") : L("modification", "تعديل", "changed");
  if (t === "subscriptions") {
    if (a === "update" && n.canceled_at && !o.canceled_at) return L("Abonnement arrêté", "إيقاف الاشتراك", "Subscription stopped");
    if (a === "update" && n.ends_at !== o.ends_at) return L(`Fin d'abonnement : ${fmtDate(o.ends_at, lang)} → ${fmtDate(n.ends_at, lang)}`, `نهاية الاشتراك: ${fmtDate(o.ends_at, lang)} ← ${fmtDate(n.ends_at, lang)}`, `Subscription end: ${fmtDate(o.ends_at, lang)} → ${fmtDate(n.ends_at, lang)}`);
    return L(`Abonnement (${verb})`, `اشتراك (${verb})`, `Subscription (${verb})`);
  }
  if (t === "payments") return L(`Paiement ${n.amount_mad ?? o.amount_mad} MAD (${verb})`, `أداء ${n.amount_mad ?? o.amount_mad} درهم (${verb})`, `Payment ${n.amount_mad ?? o.amount_mad} MAD (${verb})`);
  if (t === "teacher_permission_overrides") {
    const key = n.permission_key || o.permission_key;
    const eff = a === "delete" ? L("selon l'offre", "حسب العرض", "per plan") : n.effect === "allow" ? L("autorisé", "مسموح", "allowed") : L("interdit", "ممنوع", "denied");
    return `${permLabel(key, lang)} → ${eff}${n.limit_value != null ? ` (${n.limit_value})` : ""}`;
  }
  if (t === "plans") return L(`Offre « ${n.name || o.name} » (${verb})`, `العرض « ${n.name || o.name} » (${verb})`, `Plan “${n.name || o.name}” (${verb})`);
  if (t === "plan_permissions") return L(`Contenu d'offre : ${permLabel(n.permission_key || o.permission_key, lang)} (${verb})`, `محتوى العرض: ${permLabel(n.permission_key || o.permission_key, lang)} (${verb})`, `Plan content: ${permLabel(n.permission_key || o.permission_key, lang)} (${verb})`);
  if (t === "teacher_accounts") {
    if (n.status && n.status !== o.status) return n.status === "suspended" ? L("Compte suspendu", "توقيف الحساب", "Account suspended") : L("Compte réactivé", "إعادة تفعيل الحساب", "Account reactivated");
    if (a === "update" && o.must_change_password && !n.must_change_password) return L("Mot de passe choisi par le professeur", "اختار الأستاذ كلمة مروره", "Password set by the teacher");
    return L(`Fiche professeur (${verb})`, `بطاقة الأستاذ (${verb})`, `Teacher record (${verb})`);
  }
  if (t === "user_roles") return L(`Équipe admin (${verb})`, `فريق الإدارة (${verb})`, `Admin team (${verb})`);
  return `${t} · ${verb}`;
}

export function AuditList({ teacherId, limit = 200 }: { teacherId?: string; limit?: number }) {
  const { L, lang } = useT();
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [max, setMax] = useState(limit);

  useEffect(() => {
    (async () => {
      let query = db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(max);
      if (teacherId) query = query.eq("teacher_id", teacherId);
      const { data } = await query;
      const list = (data || []) as any[];
      setRows(list);
      const ids = Array.from(new Set(list.flatMap(r => [r.actor_id, r.teacher_id]).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await db.from("profiles").select("id, name, email").in("id", ids);
        const m: Record<string, string> = {};
        (profs || []).forEach((p: any) => (m[p.id] = p.name || p.email));
        setNames(m);
      }
    })();
  }, [teacherId, max]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => `${describe(r, L, lang)} ${names[r.actor_id] || ""} ${names[r.teacher_id] || ""}`.toLowerCase().includes(s));
  }, [rows, q, names, L, lang]);

  return (
    <div className="space-y-3">
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder={L("Filtrer…", "تصفية…", "Filter…")} />
      <div className="overflow-hidden rounded-xl border bg-card">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{L("Aucune action enregistrée.", "لا توجد أي عملية.", "No recorded action.")}</p>
        ) : (
          <ul className="divide-y">
            {filtered.map(r => (
              <li key={r.id} className="px-4 py-2.5 text-sm">
                <p className="font-medium">{describe(r, L, lang)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR")}
                  {" · "}
                  {r.actor_id ? names[r.actor_id] || L("administrateur", "مسؤول", "admin") : L("système", "النظام", "system")}
                  {!teacherId && r.teacher_id ? ` → ${names[r.teacher_id] || ""}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {rows.length >= max && (
        <Button variant="outline" size="sm" onClick={() => setMax(max + 200)}>{L("Afficher plus", "عرض المزيد", "Show more")}</Button>
      )}
    </div>
  );
}

export default function AdminAudit() {
  const { L } = useT();
  return (
    <div>
      <PageTitle
        title={L("Journal", "السجل", "Audit log")}
        subtitle={L("Toutes les actions de l'administration, non modifiables.", "جميع عمليات الإدارة، غير قابلة للتعديل.", "Every administration action, read-only.")}
      />
      <AuditList />
    </div>
  );
}
