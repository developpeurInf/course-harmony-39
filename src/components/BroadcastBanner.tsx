import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Megaphone, X } from "lucide-react";
import { Link } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  level: "info" | "success" | "warning" | "danger";
  link_url: string | null;
  link_label: string | null;
}

const TONES: Record<string, { box: string; Icon: typeof Info }> = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100", Icon: Info },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100", Icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100", Icon: AlertTriangle },
  danger: { box: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100", Icon: Megaphone },
};

/**
 * Annonces publiées par l'administration (table announcements) : la base ne
 * renvoie que celles destinées à l'utilisateur connecté et en cours de validité.
 */
export function BroadcastBanner({ userId, language }: { userId: string; language: string }) {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data, error }, { data: hidden }] = await Promise.all([
        db.from("announcements").select("id, title, body, level, link_url, link_label").eq("is_active", true).order("starts_at", { ascending: false }).limit(5),
        db.from("announcement_dismissals").select("announcement_id").eq("user_id", userId),
      ]);
      if (!alive || error) return; // migration absente : rien à afficher
      const off = new Set((hidden || []).map((h: any) => h.announcement_id));
      setItems(((data || []) as Announcement[]).filter(a => !off.has(a.id)));
    };
    load();
    const ch = db
      .channel(`announcements-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => {
      alive = false;
      db.removeChannel(ch);
    };
  }, [userId]);

  const dismiss = async (id: string) => {
    setItems(list => list.filter(a => a.id !== id));
    await db.from("announcement_dismissals").insert({ announcement_id: id, user_id: userId });
  };

  if (!items.length) return null;
  const closeLabel = language === "ar" ? "إغلاق" : language === "en" ? "Close" : "Fermer";
  return (
    <div className="mb-4 space-y-2 print:hidden" dir={language === "ar" ? "rtl" : "ltr"}>
      {items.map(a => {
        const tone = TONES[a.level] || TONES.info;
        const external = a.link_url && /^https?:/i.test(a.link_url);
        return (
          <div key={a.id} role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tone.box}`}>
            <tone.Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.title}</p>
              {a.body && <p className="mt-0.5 whitespace-pre-line opacity-90">{a.body}</p>}
              {a.link_url && (
                external ? (
                  <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold underline">{a.link_label || a.link_url}</a>
                ) : (
                  <Link to={a.link_url} className="mt-1 inline-block font-semibold underline">{a.link_label || a.link_url}</Link>
                )
              )}
            </div>
            <button type="button" onClick={() => dismiss(a.id)} aria-label={closeLabel} title={closeLabel} className="-m-1 rounded p-1 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
