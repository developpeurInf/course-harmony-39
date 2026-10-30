/**
 * Support : boîte de réception de l'équipe.
 * Onglets par statut (avec compteurs), recherche, filtres, tri, non-lus, priorité,
 * assignation, fiche du professeur, notes internes et réponses types.
 * La liste est filtrée dans le navigateur : un ticket ouvert reste affiché même s'il change de statut.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock, Inbox, Mail, MessageSquare, Pencil, Plus, RefreshCw, Star, Trash2, UserCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchInput from "@/components/SearchInput";
import { db, PageTitle, useT } from "./adminShared";
import {
  categoryLabel, priorityLabel, priorityTone, SupportThread, ticketStatusLabel, ticketStatusTone, unreadForStaff, type Ticket,
} from "@/components/support/SupportThread";
import { cn } from "@/lib/utils";

type Tab = "todo" | "in_progress" | "answered" | "closed" | "all";
type Sort = "recent" | "waiting" | "priority";
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function AdminSupport() {
  const { L, lang } = useT();
  const { user } = useAuth();
  const locale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [team, setTeam] = useState<{ user_id: string; name: string }[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("todo");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [macrosOpen, setMacrosOpen] = useState(false);
  const { adminCan } = useAccess();
  const canAssign = adminCan("admin.support.assign");
  const canMacros = adminCan("admin.support.macros");

  const load = useCallback(() => {
    db.rpc("support_admin_tickets").then(({ data, error }: any) => {
      if (error) {
        setError(error.message);
        setTickets([]);
        return;
      }
      setError("");
      setTickets(data || []);
    });
  }, []);

  useEffect(() => {
    load();
    db.rpc("admin_team").then(({ data }: any) => setTeam((data || []).map((r: any) => ({ user_id: r.user_id, name: r.name }))));
    // Liste en direct : nouveaux tickets et changements de statut
    let ch: any = null;
    try {
      ch = db.channel(`support-admin-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
        .subscribe();
    } catch (e) {
      console.error("support realtime", e);
    }
    const t = setInterval(load, 60000);
    return () => {
      clearInterval(t);
      if (ch) void db.removeChannel(ch);
    };
  }, [load]);

  const teamNames = useMemo(() => Object.fromEntries(team.map(m => [m.user_id, m.name])), [team]);
  const all = useMemo(() => tickets || [], [tickets]);

  const counts = useMemo(() => ({
    todo: all.filter(t => t.status === "open").length,
    in_progress: all.filter(t => t.status === "in_progress").length,
    answered: all.filter(t => t.status === "answered").length,
    closed: all.filter(t => t.status === "closed").length,
    all: all.length,
    unread: all.filter(unreadForStaff).length,
    urgent: all.filter(t => t.status !== "closed" && (t.priority === "urgent" || t.priority === "high")).length,
    mine: all.filter(t => t.status !== "closed" && t.assigned_to === user?.id).length,
  }), [all, user?.id]);

  const rated = all.filter(t => t.rating);
  const avgRating = rated.length ? rated.reduce((s, t) => s + (t.rating || 0), 0) / rated.length : null;

  const list = useMemo(() => {
    const inTab = (t: Ticket) => (tab === "all" ? true : tab === "todo" ? t.status === "open" : t.status === tab);
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const rows = all.filter(t =>
      (t.id === current || inTab(t))
      && (category === "all" || t.category === category)
      && (priority === "all" || t.priority === priority)
      && (assignee === "all" || (assignee === "me" ? t.assigned_to === user?.id : assignee === "none" ? !t.assigned_to : t.assigned_to === assignee))
      && (!onlyUnread || unreadForStaff(t) || t.id === current)
      && (!q || String(t.number) === q || [t.subject, t.author_name, t.author_email, t.last_message_preview].some(v => (v || "").toLowerCase().includes(q)))
    );
    const at = (t: Ticket) => new Date(t.last_message_at || t.updated_at).getTime();
    return rows.sort((a, b) =>
      sort === "waiting" ? at(a) - at(b)
        : sort === "priority" ? (PRIORITY_RANK[a.priority || "normal"] - PRIORITY_RANK[b.priority || "normal"]) || at(b) - at(a)
        : at(b) - at(a));
  }, [all, tab, search, category, priority, assignee, sort, onlyUnread, current, user?.id]);

  const ticket = all.find(t => t.id === current) || null;

  const update = async (patch: Record<string, unknown>) => {
    if (!ticket) return;
    setTickets(prev => (prev || []).map(t => (t.id === ticket.id ? { ...t, ...patch } as Ticket : t)));
    const { error } = await db.from("support_tickets").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    if (error) toast.error(error.message);
    load();
  };

  const ago = (iso: string | null | undefined) => {
    if (!iso) return "";
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 60) return L(`${min} min`, `${min} د`, `${min} min`);
    const h = Math.round(min / 60);
    if (h < 48) return L(`${h} h`, `${h} س`, `${h} h`);
    return L(`${Math.round(h / 24)} j`, `${Math.round(h / 24)} ي`, `${Math.round(h / 24)} d`);
  };

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "todo", label: L("À traiter", "للمعالجة", "To handle"), n: counts.todo },
    { id: "in_progress", label: L("En cours", "قيد المعالجة", "In progress"), n: counts.in_progress },
    { id: "answered", label: L("Attente du prof", "في انتظار الأستاذ", "Waiting on teacher"), n: counts.answered },
    { id: "closed", label: L("Fermés", "مغلقة", "Closed"), n: counts.closed },
    { id: "all", label: L("Tous", "الكل", "All"), n: counts.all },
  ];

  const selectCls = "h-9 rounded-md border bg-background px-2 text-sm";

  return (
    <div>
      <PageTitle
        title={L("Support", "الدعم", "Support")}
        subtitle={L("Les demandes des professeurs, avec leur historique complet.", "طلبات الأساتذة مع سجلها الكامل.", "Teachers' requests with their full history.")}
        actions={<>
          {canMacros && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMacrosOpen(true)}><Zap className="h-4 w-4" />{L("Réponses types", "ردود جاهزة", "Canned replies")}</Button>}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={load} aria-label={L("Actualiser", "تحديث", "Refresh")}><RefreshCw className="h-4 w-4" /></Button>
        </>}
      />
      {error && <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{L("Appliquez la migration 20261108090000_support_desk.", "طبّق الترحيل 20261108090000.", "Apply migration 20261108090000.")} ({error})</p>}

      {/* Indicateurs */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Inbox, label: L("Non lus", "غير مقروءة", "Unread"), value: counts.unread, tone: counts.unread ? "text-primary" : "", onClick: () => { setOnlyUnread(true); setTab("all"); } },
          { icon: AlertTriangle, label: L("Urgents / hauts", "عاجلة / مرتفعة", "Urgent / high"), value: counts.urgent, tone: counts.urgent ? "text-rose-600" : "", onClick: () => { setSort("priority"); setTab("all"); } },
          { icon: UserCheck, label: L("Assignés à moi", "مسندة إلي", "Assigned to me"), value: counts.mine, tone: "", onClick: () => { setAssignee("me"); setTab("all"); } },
          { icon: Star, label: L("Satisfaction", "الرضا", "Satisfaction"), value: avgRating ? `${avgRating.toFixed(1).replace(".", ",")}/5` : "—", tone: "", onClick: undefined },
        ].map(s => (
          <button key={s.label} type="button" onClick={s.onClick} disabled={!s.onClick}
            className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-start transition-colors enabled:hover:border-foreground/20">
            <s.icon className={cn("h-5 w-5 text-muted-foreground", s.tone)} />
            <span>
              <span className={cn("block text-lg font-semibold leading-tight tabular-nums", s.tone)}>{s.value}</span>
              <span className="block text-xs text-muted-foreground">{s.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Onglets */}
      <div className="mb-3 flex gap-1 overflow-x-auto border-b">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => { setTab(t.id); setOnlyUnread(false); }}
            className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted")}>{t.n}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-17rem)] lg:min-h-[34rem] lg:grid-cols-[22rem_1fr]">
        {/* Liste */}
        <section className={cn("flex min-h-0 flex-col gap-2", ticket && "hidden lg:flex")}>
          <SearchInput value={search} onChange={setSearch} placeholder={L("Rechercher : sujet, prof, n°…", "بحث: الموضوع، الأستاذ، الرقم…", "Search: subject, teacher, #…")} />
          <div className="flex flex-wrap gap-1.5">
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls} aria-label={L("Type", "النوع", "Type")}>
              <option value="all">{L("Tous types", "كل الأنواع", "All types")}</option>
              {["question", "bug", "payment", "idea"].map(c => <option key={c} value={c}>{categoryLabel(c, L)}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} className={selectCls} aria-label={L("Priorité", "الأولوية", "Priority")}>
              <option value="all">{L("Toutes priorités", "كل الأولويات", "All priorities")}</option>
              {["urgent", "high", "normal", "low"].map(p => <option key={p} value={p}>{priorityLabel(p, L)}</option>)}
            </select>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className={selectCls} aria-label={L("Assigné à", "مسند إلى", "Assigned to")}>
              <option value="all">{L("Tout le monde", "الجميع", "Everyone")}</option>
              <option value="me">{L("Moi", "أنا", "Me")}</option>
              <option value="none">{L("Non assignés", "غير مسندة", "Unassigned")}</option>
              {team.filter(m => m.user_id !== user?.id).map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} className={selectCls} aria-label={L("Trier", "ترتيب", "Sort")}>
              <option value="recent">{L("Activité récente", "النشاط الأحدث", "Recent activity")}</option>
              <option value="waiting">{L("Attend depuis le plus longtemps", "الأطول انتظارا", "Waiting longest")}</option>
              <option value="priority">{L("Priorité", "الأولوية", "Priority")}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={onlyUnread} onChange={e => setOnlyUnread(e.target.checked)} />{L("Non lus seulement", "غير المقروءة فقط", "Unread only")}
          </label>

          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pe-1">
            {tickets === null && <li className="text-sm text-muted-foreground">{L("Chargement…", "جارٍ التحميل…", "Loading…")}</li>}
            {tickets !== null && list.length === 0 && (
              <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{L("Aucun ticket ici.", "لا توجد تذاكر هنا.", "No ticket here.")}</li>
            )}
            {list.map(t => {
              const unread = unreadForStaff(t);
              const waiting = t.status !== "closed" && !t.last_from_staff;
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setCurrent(t.id)}
                    className={cn("w-full rounded-lg border bg-card px-3 py-2 text-start text-sm transition-colors hover:bg-muted/60", current === t.id && "border-primary ring-1 ring-primary/30", unread && "border-s-4 border-s-primary")}>
                    <span className="flex items-center gap-1.5">
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={L("Non lu", "غير مقروء", "Unread")} />}
                      <span className="text-xs tabular-nums text-muted-foreground">#{t.number}</span>
                      <span className={cn("min-w-0 flex-1 truncate", unread ? "font-semibold" : "font-medium")}>{t.subject}</span>
                      {t.priority && t.priority !== "normal" && <span className={cn("shrink-0 rounded px-1.5 text-[10px] font-medium", priorityTone(t.priority))}>{priorityLabel(t.priority, L)}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t.author_name || "—"} · {t.last_from_staff ? L("Vous : ", "أنت: ", "You: ") : ""}{t.last_message_preview || ""}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn("rounded-full px-2", ticketStatusTone(t.status))}>{ticketStatusLabel(t.status, L)}</span>
                      <span>{categoryLabel(t.category, L)}</span>
                      {t.assigned_to && <span>· {t.assigned_to === user?.id ? L("moi", "أنا", "me") : teamNames[t.assigned_to] || "—"}</span>}
                      <span className={cn("ms-auto inline-flex items-center gap-0.5", waiting && "font-medium text-amber-700 dark:text-amber-400")}>
                        {waiting && <Clock className="h-3 w-3" />}{ago(t.last_message_at || t.updated_at)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Ticket ouvert */}
        <section className={cn("min-h-0 rounded-xl border bg-card", !ticket && "hidden lg:block")}>
          {ticket ? (
            <div className="grid h-full min-h-0 gap-4 p-3 sm:p-4 xl:grid-cols-[1fr_16rem]">
              <div className="flex min-h-[28rem] flex-col gap-3">
                <div className="flex items-start gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 lg:hidden" onClick={() => setCurrent(null)} aria-label={L("Retour", "رجوع", "Back")}><ArrowLeft className="h-4 w-4 rtl:rotate-180" /></Button>
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-snug"><span className="text-muted-foreground">#{ticket.number}</span> {ticket.subject}</h2>
                    <p className="text-xs text-muted-foreground">{categoryLabel(ticket.category, L)} · {L("ouvert le", "فُتح في", "opened")} {new Date(ticket.created_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <SupportThread key={ticket.id} ticket={ticket} staff tr={L} locale={locale} onChanged={load} authorName={ticket.author_name} staffNames={teamNames} />
                </div>
              </div>

              {/* Panneau de gestion */}
              <aside className="space-y-4 text-sm xl:border-s xl:ps-4">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{L("Statut", "الحالة", "Status")}</Label>
                    <select value={ticket.status} onChange={e => update({ status: e.target.value })} className={cn(selectCls, "w-full")}>
                      {["open", "in_progress", "answered", "closed"].map(s => <option key={s} value={s}>{ticketStatusLabel(s, L)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{L("Priorité", "الأولوية", "Priority")}</Label>
                    <select value={ticket.priority || "normal"} onChange={e => update({ priority: e.target.value })} disabled={!canAssign} className={cn(selectCls, "w-full disabled:opacity-60")}>
                      {["urgent", "high", "normal", "low"].map(p => <option key={p} value={p}>{priorityLabel(p, L)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{L("Assigné à", "مسند إلى", "Assigned to")}</Label>
                    <select value={ticket.assigned_to || ""} onChange={e => update({ assigned_to: e.target.value || null })} disabled={!canAssign} className={cn(selectCls, "w-full disabled:opacity-60")}>
                      <option value="">{L("Personne", "لا أحد", "Nobody")}</option>
                      {team.map(m => <option key={m.user_id} value={m.user_id}>{m.user_id === user?.id ? `${m.name} (${L("moi", "أنا", "me")})` : m.name}</option>)}
                    </select>
                    {ticket.assigned_to !== user?.id && (
                      <button type="button" onClick={() => update({ assigned_to: user?.id, ...(ticket.status === "open" ? { status: "in_progress" } : {}) })} className="text-xs font-medium text-primary hover:underline">
                        {L("Je m'en occupe", "سأتكفل به", "I'll take it")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L("Professeur", "الأستاذ", "Teacher")}</p>
                  <p className="font-medium">{ticket.author_name || "—"}</p>
                  {ticket.author_email && (
                    <a href={`mailto:${ticket.author_email}?subject=${encodeURIComponent(`#${ticket.number} ${ticket.subject}`)}`} className="flex items-center gap-1.5 break-all text-xs text-muted-foreground hover:text-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />{ticket.author_email}
                    </a>
                  )}
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />{L(`${ticket.author_tickets || 1} demande(s) au total`, `${ticket.author_tickets || 1} طلب إجمالا`, `${ticket.author_tickets || 1} request(s) in total`)}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs"><Link to={`/admin/teachers/${ticket.author_id}`}>{L("Ouvrir la fiche", "فتح البطاقة", "Open profile")}</Link></Button>
                    {(ticket.author_tickets || 0) > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSearch(ticket.author_email || ticket.author_name || ""); setTab("all"); }}>
                        {L("Ses autres demandes", "طلباته الأخرى", "Other requests")}
                      </Button>
                    )}
                  </div>
                </div>

                <dl className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-2"><dt>{L("Messages", "الرسائل", "Messages")}</dt><dd className="tabular-nums">{ticket.messages ?? "—"}</dd></div>
                  <div className="flex justify-between gap-2"><dt>{L("Dernière activité", "آخر نشاط", "Last activity")}</dt><dd>{ago(ticket.last_message_at || ticket.updated_at)}</dd></div>
                  {ticket.closed_at && <div className="flex justify-between gap-2"><dt>{L("Fermé le", "أُغلق في", "Closed")}</dt><dd>{new Date(ticket.closed_at).toLocaleDateString(locale)}</dd></div>}
                  {ticket.rating ? <div className="flex justify-between gap-2"><dt>{L("Avis", "الرأي", "Rating")}</dt><dd>{"★".repeat(ticket.rating)}{"☆".repeat(5 - ticket.rating)}</dd></div> : null}
                </dl>
              </aside>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" />
              {L("Choisissez un ticket dans la liste.", "اختر تذكرة من القائمة.", "Pick a ticket from the list.")}
            </div>
          )}
        </section>
      </div>

      <MacrosDialog open={macrosOpen} onOpenChange={setMacrosOpen} L={L} />
    </div>
  );
}

/** Gestion des réponses types ({nom} = prénom du professeur) */
function MacrosDialog({ open, onOpenChange, L }: { open: boolean; onOpenChange: (v: boolean) => void; L: (fr: string, ar: string, en: string) => string }) {
  const [rows, setRows] = useState<{ id: string; title: string; body: string }[]>([]);
  const [edit, setEdit] = useState<{ id?: string; title: string; body: string } | null>(null);

  const load = () => db.from("support_macros").select("id, title, body").order("title").then(({ data }: any) => setRows(data || []));
  useEffect(() => { if (open) load(); }, [open]);

  const save = async () => {
    if (!edit || !edit.title.trim() || !edit.body.trim()) return;
    const payload = { title: edit.title.trim(), body: edit.body.trim() };
    const { error } = edit.id
      ? await db.from("support_macros").update(payload).eq("id", edit.id)
      : await db.from("support_macros").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEdit(null);
    load();
  };
  const remove = async (id: string) => {
    const { error } = await db.from("support_macros").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) setEdit(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{L("Réponses types", "ردود جاهزة", "Canned replies")}</DialogTitle></DialogHeader>
        {edit ? (
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="mc-t">{L("Titre", "العنوان", "Title")}</Label><Input id="mc-t" value={edit.title} maxLength={80} onChange={e => setEdit({ ...edit, title: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="mc-b">{L("Texte", "النص", "Text")}</Label>
              <Textarea id="mc-b" rows={7} value={edit.body} maxLength={5000} onChange={e => setEdit({ ...edit, body: e.target.value })} />
              <p className="text-xs text-muted-foreground">{L("{nom} sera remplacé par le prénom du professeur.", "سيُستبدل {nom} باسم الأستاذ.", "{nom} becomes the teacher's first name.")}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEdit(null)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
              <Button onClick={save} disabled={!edit.title.trim() || !edit.body.trim()}>{L("Enregistrer", "حفظ", "Save")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
              {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">{L("Aucune réponse type.", "لا توجد ردود جاهزة.", "No canned reply.")}</li>}
              {rows.map(r => (
                <li key={r.id} className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{r.body}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEdit(r)} aria-label={L("Modifier", "تعديل", "Edit")}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r.id)} aria-label={L("Supprimer", "حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
            <Button className="w-full gap-1.5" variant="outline" onClick={() => setEdit({ title: "", body: "" })}><Plus className="h-4 w-4" />{L("Nouvelle réponse type", "رد جاهز جديد", "New canned reply")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
