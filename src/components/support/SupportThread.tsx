/** Fil d'un ticket de support (professeur ou administration) */
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const db = supabase as any;
type Tr = (fr: string, ar: string, en: string) => string;

export interface Ticket {
  id: string;
  author_id: string;
  subject: string;
  category: string;
  status: "open" | "answered" | "closed";
  created_at: string;
  updated_at: string;
}

export const ticketStatusLabel = (s: string, tr: Tr) =>
  s === "open" ? tr("En attente", "في الانتظار", "Waiting") : s === "answered" ? tr("Répondu", "تم الرد", "Answered") : tr("Fermé", "مغلق", "Closed");
export const ticketStatusTone = (s: string) =>
  s === "open" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
    : s === "answered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    : "bg-muted text-muted-foreground";
export const categoryLabel = (c: string, tr: Tr) =>
  c === "bug" ? tr("Problème", "مشكلة", "Bug") : c === "payment" ? tr("Paiement", "الأداء", "Payment") : c === "idea" ? tr("Suggestion", "اقتراح", "Idea") : tr("Question", "سؤال", "Question");

export function SupportThread({ ticket, staff, tr, locale, onChanged }: { ticket: Ticket; staff: boolean; tr: Tr; locale: string; onChanged: () => void }) {
  const [msgs, setMsgs] = useState<any[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => db.from("support_messages").select("*").eq("ticket_id", ticket.id).order("created_at")
    .then(({ data }: any) => setMsgs(data || []));
  useEffect(() => {
    load();
    const ch = supabase.channel(`support-${ticket.id}`)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticket.id}` }, () => load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [msgs]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("support_messages").insert({ ticket_id: ticket.id, body: text.trim(), author_id: u?.user?.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    load();
    onChanged();
  };
  const setStatus = async (status: string) => {
    const { error } = await db.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    if (error) toast.error(error.message);
    else onChanged();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{ticket.subject}</h2>
          <p className="text-xs text-muted-foreground">{categoryLabel(ticket.category, tr)} · <span className={cn("rounded-full px-2 py-0.5", ticketStatusTone(ticket.status))}>{ticketStatusLabel(ticket.status, tr)}</span></p>
        </div>
        {ticket.status !== "closed"
          ? <Button size="sm" variant="outline" onClick={() => setStatus("closed")}>{tr("Fermer le ticket", "إغلاق التذكرة", "Close ticket")}</Button>
          : <Button size="sm" variant="outline" onClick={() => setStatus("open")}>{tr("Rouvrir", "إعادة الفتح", "Reopen")}</Button>}
      </div>
      <div className="min-h-[12rem] flex-1 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
        {msgs === null ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : msgs.map(m => {
          const mine = staff ? m.is_staff : !m.is_staff;
          return (
            <div key={m.id} className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", mine ? "ms-auto bg-primary text-primary-foreground" : "bg-background border")}>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {m.is_staff ? tr("Support", "الدعم", "Support") : tr("Professeur", "الأستاذ", "Teacher")} · {new Date(m.created_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {ticket.status !== "closed" && (
        <div className="flex gap-2">
          <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} maxLength={5000} placeholder={tr("Votre message…", "رسالتك…", "Your message…")} aria-label={tr("Message", "رسالة", "Message")} />
          <Button onClick={send} disabled={busy || !text.trim()} className="h-auto gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
        </div>
      )}
    </div>
  );
}
