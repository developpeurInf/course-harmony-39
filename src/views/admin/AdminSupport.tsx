import { useEffect, useState } from "react";
import { db, PageTitle, useT } from "./adminShared";
import { categoryLabel, SupportThread, ticketStatusLabel, ticketStatusTone, type Ticket } from "@/components/support/SupportThread";
import { cn } from "@/lib/utils";

/** Support : tickets des professeurs, en attente d'abord */
export default function AdminSupport() {
  const { L, lang } = useT();
  const locale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";
  const [status, setStatus] = useState("open");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    let q = db.from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(300);
    if (status !== "all") q = q.eq("status", status);
    q.then(async ({ data, error }: any) => {
      if (error) {
        setError(error.message);
        setTickets([]);
        return;
      }
      setTickets(data || []);
      const ids = [...new Set((data || []).map((t: any) => t.author_id))];
      if (ids.length) {
        const { data: p } = await db.from("profiles").select("id, name").in("id", ids);
        const m: Record<string, string> = {};
        (p || []).forEach((x: any) => (m[x.id] = x.name));
        setNames(m);
      }
    });
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const ticket = tickets?.find(t => t.id === current) || null;
  return (
    <div>
      <PageTitle title={L("Support", "الدعم", "Support")} subtitle={L("Questions et problèmes envoyés par les professeurs.", "الأسئلة والمشاكل التي يرسلها الأساتذة.", "Questions and problems sent by teachers.")}
        actions={
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label={L("Statut", "الحالة", "Status")}>
            <option value="open">{L("En attente", "في الانتظار", "Waiting")}</option>
            <option value="answered">{L("Répondus", "تم الرد", "Answered")}</option>
            <option value="closed">{L("Fermés", "مغلقة", "Closed")}</option>
            <option value="all">{L("Tous", "الكل", "All")}</option>
          </select>
        } />
      {error && <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{L("Appliquez la migration 20261107090000.", "طبّق الترحيل 20261107090000.", "Apply migration 20261107090000.")} ({error})</p>}
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <ul className="space-y-1.5">
          {(tickets || []).length === 0 && <li className="text-sm text-muted-foreground">{L("Aucun ticket.", "لا توجد تذاكر.", "No ticket.")}</li>}
          {(tickets || []).map(t => (
            <li key={t.id}>
              <button type="button" onClick={() => setCurrent(t.id)} className={cn("w-full rounded-lg border bg-card px-3 py-2 text-start text-sm hover:bg-muted", current === t.id && "border-primary")}>
                <span className="block truncate font-medium">{t.subject}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("rounded-full px-2", ticketStatusTone(t.status))}>{ticketStatusLabel(t.status, L)}</span>
                  {categoryLabel(t.category, L)} · {names[t.author_id] || "—"} · {new Date(t.updated_at).toLocaleDateString(locale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border bg-card p-4">
          {ticket ? <SupportThread ticket={ticket} staff tr={L} locale={locale} onChanged={load} /> : <p className="text-sm text-muted-foreground">{L("Choisissez un ticket.", "اختر تذكرة.", "Pick a ticket.")}</p>}
        </div>
      </div>
    </div>
  );
}
