/**
 * Portail parents : bulletin en lecture seule, ouvert par un lien envoyé par le
 * professeur (sans compte). Notes, absences, devoirs, appréciations ; message au professeur.
 */
import { useEffect, useState } from "react";
import { BookOpen, CalendarX, ClipboardList, GraduationCap, Loader2, MessageSquare, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const db = supabase as any;

export default function ParentPortal() {
  const params = useSearchParams();
  const token = params?.get("t") || "";
  const { language } = useLanguage();
  const { settings } = useAppSettings();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [canMessage, setCanMessage] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("invalid");
      return;
    }
    db.rpc("parent_report", { p_token: token }).then(({ data, error }: any) => {
      if (error) setError("unavailable");
      else if (data?.error) setError(data.error);
      else setData(data);
    });
    // Messagerie ouverte seulement si l'offre du professeur l'inclut (absent avant migration : ouverte)
    db.rpc("parent_can_message", { p_token: token }).then(({ data, error }: any) => setCanMessage(error ? true : !!data));
  }, [token]);

  const day = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const n20 = (score: number, total: number) => (total > 0 ? String(Math.round((score / total) * 200) / 10).replace(".", language === "en" ? "." : ",") : "—");
  const app = settings.identity.appName || "Math infini";

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    const { data: ok, error } = await db.rpc("parent_send_message", { p_token: token, p_name: name, p_body: msg });
    setSending(false);
    if (error || !ok) {
      toast.error(error?.message?.includes("Trop") ? tr("Limite de messages atteinte pour aujourd'hui.", "تم بلوغ حد الرسائل لهذا اليوم.", "Message limit reached for today.") : tr("Envoi impossible.", "تعذر الإرسال.", "Unable to send."));
      return;
    }
    setMsg("");
    toast.success(tr("Message envoyé au professeur", "تم إرسال الرسالة إلى الأستاذ", "Message sent to the teacher"));
  };

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <section className="rounded-xl border bg-card p-4 print:break-inside-avoid">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h2>
      {children}
    </section>
  );
  const empty = <p className="text-sm text-muted-foreground">{tr("Rien pour l'instant.", "لا شيء حاليا.", "Nothing yet.")}</p>;
  const status = (s: string) => s === "absent" ? tr("Absent", "غائب", "Absent") : s === "late" ? tr("Retard", "تأخر", "Late") : s === "excused" ? tr("Absence justifiée", "غياب مبرر", "Excused") : s;

  return (
    <div className="min-h-screen bg-muted/30" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <span className="font-semibold">{app}</span>
          <div className="flex items-center gap-2 print:hidden">
            {data && <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.print()}><Printer className="h-4 w-4" />{tr("Imprimer", "طباعة", "Print")}</Button>}
            <LanguageSelector />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {error ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {error === "disabled"
              ? tr("Le portail parents est désactivé pour le moment.", "فضاء الآباء معطل حاليا.", "The parent portal is disabled for now.")
              : tr("Ce lien n'est plus valide. Demandez un nouveau lien au professeur.", "هذا الرابط لم يعد صالحا. اطلب رابطا جديدا من الأستاذ.", "This link is no longer valid. Ask the teacher for a new one.")}
          </div>
        ) : !data ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-semibold">{data.student}</h1>
              <p className="text-sm text-muted-foreground">{[data.room, data.teacher ? tr(`Professeur : ${data.teacher}`, `الأستاذ: ${data.teacher}`, `Teacher: ${data.teacher}`) : ""].filter(Boolean).join(" · ")}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-card p-3 text-center"><p className="text-xl font-semibold tabular-nums">{data.attendance?.absent ?? 0}</p><p className="text-xs text-muted-foreground">{tr("absences", "غيابات", "absences")}</p></div>
              <div className="rounded-xl border bg-card p-3 text-center"><p className="text-xl font-semibold tabular-nums">{data.attendance?.late ?? 0}</p><p className="text-xs text-muted-foreground">{tr("retards", "تأخرات", "lates")}</p></div>
              <div className="rounded-xl border bg-card p-3 text-center"><p className="text-xl font-semibold tabular-nums">{data.attendance?.excused ?? 0}</p><p className="text-xs text-muted-foreground">{tr("justifiées", "مبررة", "excused")}</p></div>
            </div>

            <Section icon={GraduationCap} title={tr("Carnet de notes", "دفتر النقط", "Gradebook")}>
              {(data.marks || []).length === 0 ? empty : (
                <ul className="divide-y text-sm">
                  {data.marks.map((m: any, i: number) => (
                    <li key={i} className="flex justify-between gap-2 py-1.5">
                      <span>{m.term} · {m.title}</span>
                      <span className="font-semibold tabular-nums">{m.absent ? tr("Absent", "غائب", "Absent") : m.value === null ? "—" : `${String(m.value).replace(".", ",")} / ${m.max}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={ClipboardList} title={tr("Quiz", "الاختبارات", "Quizzes")}>
              {(data.quizzes || []).length === 0 ? empty : (
                <ul className="divide-y text-sm">
                  {data.quizzes.map((q: any, i: number) => (
                    <li key={i} className="flex justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate">{q.title} <span className="text-xs text-muted-foreground">· {day(q.at)}</span></span>
                      <span className="shrink-0 font-semibold tabular-nums">{n20(q.score, q.total)} / 20</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={BookOpen} title={tr("Exercices rendus", "التمارين المنجزة", "Exercises handed in")}>
              {(data.exercises || []).length === 0 ? empty : (
                <ul className="divide-y text-sm">
                  {data.exercises.map((x: any, i: number) => (
                    <li key={i} className="flex justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate">{x.title}{x.late ? <span className="text-xs text-amber-700"> · {tr("en retard", "متأخر", "late")}</span> : null}</span>
                      <span className="shrink-0 tabular-nums">{x.grade !== null && x.grade !== undefined ? `${String(x.grade).replace(".", ",")} / ${x.max}` : x.status === "returned" ? tr("corrigé", "مصحح", "graded") : tr("en correction", "قيد التصحيح", "being graded")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={CalendarX} title={tr("Absences et retards récents", "الغيابات والتأخرات الأخيرة", "Recent absences and lates")}>
              {(data.attendance?.recent || []).length === 0 ? empty : (
                <ul className="divide-y text-sm">
                  {data.attendance.recent.map((a: any, i: number) => (
                    <li key={i} className="flex justify-between gap-2 py-1.5"><span>{day(a.date)}</span><span>{status(a.status)}</span></li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={BookOpen} title={tr("Devoirs", "الواجبات", "Homework")}>
              {(data.homework || []).length === 0 ? empty : (
                <ul className="space-y-2 text-sm">
                  {data.homework.map((h: any, i: number) => (
                    <li key={i} className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">{h.title}{h.due ? ` · ${tr("pour le", "لـ", "due")} ${day(h.due)}` : ""}</p>
                      <p className="whitespace-pre-line">{h.homework}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {(data.appreciations || []).length > 0 && (
              <Section icon={MessageSquare} title={tr("Appréciations", "الملاحظات", "Comments")}>
                <ul className="space-y-2 text-sm">
                  {data.appreciations.map((a: any, i: number) => <li key={i}><span className="font-semibold">{a.term} : </span>{a.text}</li>)}
                </ul>
              </Section>
            )}

            {canMessage && <section className="space-y-2 rounded-xl border bg-card p-4 print:hidden">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Send className="h-4 w-4 text-primary" />{tr("Écrire au professeur", "مراسلة الأستاذ", "Write to the teacher")}</h2>
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder={tr("Votre nom (ex. mère de l'élève)", "اسمك (مثال: أم التلميذ)", "Your name (e.g. student's mother)")} aria-label={tr("Votre nom", "اسمك", "Your name")} />
              <Textarea rows={3} value={msg} onChange={e => setMsg(e.target.value)} maxLength={2000} placeholder={tr("Votre message", "رسالتك", "Your message")} aria-label={tr("Votre message", "رسالتك", "Your message")} />
              <div className="flex justify-end"><Button onClick={send} disabled={sending || !msg.trim()} className="gap-1.5">{sending && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Envoyer", "إرسال", "Send")}</Button></div>
            </section>}
          </>
        )}
      </main>
    </div>
  );
}
