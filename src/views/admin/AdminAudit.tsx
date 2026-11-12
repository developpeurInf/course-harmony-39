import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { downloadBlob } from "@/lib/download";
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
    case "delete_teacher": return L(`Professeur supprimé : ${n.name || n.email || ""}`, `حذف الأستاذ: ${n.name || n.email || ""}`, `Teacher deleted: ${n.name || n.email || ""}`);
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
    return `${permLabel(key, lang)} ${lang === "ar" ? "←" : "→"} ${eff}${n.limit_value != null ? ` (${n.limit_value})` : ""}`;
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [table, setTable] = useState("");
  const [actor, setActor] = useState("");
  const [team, setTeam] = useState<{ user_id: string; name: string }[]>([]);

  useEffect(() => {
    if (teacherId) return;
    db.rpc("admin_team").then(({ data }: any) => setTeam(data || []));
  }, [teacherId]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const arrow = lang === "ar" ? "←" : "→";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let query = db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(max);
      if (teacherId) query = query.eq("teacher_id", teacherId);
      // filtres appliqués par la base : toute la période est cherchée, pas seulement les lignes chargées
      if (from) query = query.gte("created_at", new Date(`${from}T00:00:00`).toISOString());
      if (to) query = query.lte("created_at", new Date(`${to}T23:59:59`).toISOString());
      if (table) query = query.eq("table_name", table);
      if (actor === "system") query = query.is("actor_id", null);
      else if (actor) query = query.eq("actor_id", actor);
      const { data, error: err } = await query;
      if (!alive) return;
      setLoading(false);
      setError(err ? err.message : "");
      if (err) toast.error(L(`Chargement du journal impossible : ${err.message}`, `تعذر تحميل السجل: ${err.message}`, `Could not load the log: ${err.message}`));
      const list = (data || []) as any[];
      setRows(list);
      const ids = Array.from(new Set(list.flatMap(r => [r.actor_id, r.teacher_id]).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await db.from("profiles").select("id, name, email").in("id", ids);
        const m: Record<string, string> = {};
        (profs || []).forEach((p: any) => (m[p.id] = p.name || p.email));
        if (alive) setNames(m);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, max, from, to, table, actor]);

  const exportCsv = () => {
    const head = [L("Date", "التاريخ", "Date"), L("Action", "العملية", "Action"), L("Auteur", "المنفذ", "Author"), L("Professeur", "الأستاذ", "Teacher")];
    const lines = filtered.map(r => [new Date(r.created_at).toISOString(), describe(r, L, lang), r.actor_id ? names[r.actor_id] || "" : "system", names[r.teacher_id] || ""]);
    const csv = "\uFEFF" + [head, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `journal_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => `${describe(r, L, lang)} ${names[r.actor_id] || ""} ${names[r.teacher_id] || ""}`.toLowerCase().includes(s));
  }, [rows, q, names, L, lang]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input className="min-w-[180px] flex-1" value={q} onChange={e => setQ(e.target.value)} aria-label={L("Filtrer le journal", "تصفية السجل", "Filter the log")} placeholder={L("Filtrer…", "تصفية…", "Filter…")} />
        <Input type="date" className="w-auto" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} aria-label={L("Du", "من", "From")} />
        <Input type="date" className="w-auto" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} aria-label={L("Au", "إلى", "To")} />
        <select className="h-10 rounded-md border bg-background px-2 text-sm" value={table} onChange={e => setTable(e.target.value)} aria-label={L("Type", "النوع", "Type")}>
          <option value="">{L("Tous les types", "كل الأنواع", "All types")}</option>
          <option value="subscriptions">{L("Abonnements", "الاشتراكات", "Subscriptions")}</option>
          <option value="payments">{L("Paiements", "الأداءات", "Payments")}</option>
          <option value="subscription_requests">{L("Demandes", "الطلبات", "Requests")}</option>
          <option value="plans">{L("Offres", "العروض", "Plans")}</option>
          <option value="plan_permissions">{L("Habilitations des offres", "صلاحيات العروض", "Plan permissions")}</option>
          <option value="teacher_permission_overrides">{L("Exceptions", "الاستثناءات", "Overrides")}</option>
          <option value="teacher_accounts">{L("Comptes", "الحسابات", "Accounts")}</option>
          <option value="user_roles">{L("Équipe", "الفريق", "Team")}</option>
          <option value="promo_codes">{L("Codes promo", "رموز التخفيض", "Promo codes")}</option>
          <option value="announcements">{L("Annonces", "الإعلانات", "Announcements")}</option>
        </select>
        {!teacherId && (
          <select className="h-10 rounded-md border bg-background px-2 text-sm" value={actor} onChange={e => setActor(e.target.value)} aria-label={L("Auteur", "المنفذ", "Author")}>
            <option value="">{L("Tous les auteurs", "كل المنفذين", "All authors")}</option>
            {team.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
            <option value="system">{L("Système", "النظام", "System")}</option>
          </select>
        )}
        <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4" />CSV</Button>
      </div>
      {q.trim() && !loading && (
        <p className="text-xs text-muted-foreground">
          {L(
            `Filtre appliqué aux ${rows.length} dernières actions chargées (${filtered.length} résultat(s)).`,
            `التصفية مطبقة على آخر ${rows.length} عملية محملة (${filtered.length} نتيجة).`,
            `Filter applied to the last ${rows.length} loaded actions (${filtered.length} result(s)).`
          )}
          {rows.length >= max && ` ${L("« Afficher plus » pour chercher plus loin.", "« عرض المزيد » للبحث أبعد.", "Use “Show more” to search further back.")}`}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        {loading && rows.length === 0 ? (
          <div className="h-32 animate-pulse bg-muted/40" />
        ) : error && rows.length === 0 ? (
          <p role="alert" className="p-4 text-sm text-red-700 dark:text-red-300">{L("Impossible de charger le journal : ", "تعذر تحميل السجل: ", "Could not load the log: ")}{error}</p>
        ) : filtered.length === 0 ? (
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
                  {!teacherId && r.teacher_id ? ` ${arrow} ${names[r.teacher_id] || ""}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {rows.length >= max && (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => setMax(max + 200)}>{loading ? L("Chargement…", "جار التحميل…", "Loading…") : L("Afficher plus", "عرض المزيد", "Show more")}</Button>
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
