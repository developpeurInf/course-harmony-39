/** Messages envoyés par les parents depuis le portail parents (non lus d'abord) */
import { useEffect, useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const db = supabase as any;

export function ParentMessagesCard() {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [all, setAll] = useState(false);

  const load = () => {
    let q = db.from("parent_messages").select("*").order("created_at", { ascending: false }).limit(20);
    if (!all) q = q.is("read_at", null);
    q.then(async ({ data, error }: any) => {
      if (error) return;
      setRows(data || []);
      const ids = [...new Set((data || []).map((m: any) => m.student_id))];
      if (ids.length) {
        const { data: p } = await db.from("profiles").select("id, name").in("id", ids);
        const m: Record<string, string> = {};
        (p || []).forEach((x: any) => (m[x.id] = x.name));
        setNames(m);
      }
    });
  };
  useEffect(load, [all]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows.length && !all) return null;
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
  const markRead = async (id: string) => {
    await db.from("parent_messages").update({ read_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-primary" />{tr("Messages des parents", "رسائل الآباء", "Messages from parents")}</h2>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAll(v => !v)}>{all ? tr("Non lus seulement", "غير المقروءة فقط", "Unread only") : tr("Tout afficher", "عرض الكل", "Show all")}</Button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{tr("Aucun message.", "لا توجد رسائل.", "No message.")}</p> : (
        <ul className="space-y-2">
          {rows.map(m => (
            <li key={m.id} className={`rounded-lg border p-2.5 text-sm ${m.read_at ? "opacity-70" : ""}`}>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{names[m.student_id] || "—"}{m.parent_name ? ` · ${m.parent_name}` : ""} · {new Date(m.created_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                {!m.read_at && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => markRead(m.id)} aria-label={tr("Marquer comme lu", "تعليم كمقروء", "Mark as read")}><Check className="h-3.5 w-3.5" /></Button>}
              </div>
              <p className="mt-1 whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
