/** Aide et support (professeur) : questions fréquentes + tickets avec l'administration */
import { useEffect, useState } from "react";
import { LifeBuoy, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SupportThread, ticketStatusLabel, ticketStatusTone, type Ticket } from "@/components/support/SupportThread";
import { cn } from "@/lib/utils";

const db = supabase as any;

export default function Support() {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("question");
  const [body, setBody] = useState("");
  const [missing, setMissing] = useState(false);

  const load = () => db.from("support_tickets").select("*").order("updated_at", { ascending: false })
    .then(({ data, error }: any) => {
      if (error) setMissing(true);
      setTickets(data || []);
    });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (subject.trim().length < 2 || !body.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await db.from("support_tickets").insert({ subject: subject.trim(), category, author_id: u?.user?.id }).select("*").single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await db.from("support_messages").insert({ ticket_id: data.id, body: body.trim(), author_id: u?.user?.id });
    setSubject("");
    setBody("");
    setCreating(false);
    setCurrent(data.id);
    toast.success(tr("Demande envoyée. Vous serez notifié de la réponse.", "تم إرسال الطلب. ستتلقى إشعارا بالرد.", "Request sent. You'll be notified of the answer."));
    load();
  };

  const FAQ = [
    [tr("Mes élèves ne voient pas un cours", "تلاميذي لا يرون درسا", "My students can't see a course"), tr("Vérifiez que le cours et la classe sont « Visibles », ou qu'une date de publication programmée n'est pas dans le futur.", "تأكد أن الدرس والقسم « مرئيان » أو أن تاريخ النشر المبرمج ليس في المستقبل.", "Check the course and class are “Visible”, or that a scheduled publish date isn't in the future.")],
    [tr("Un élève a oublié son mot de passe", "تلميذ نسي كلمة المرور", "A student forgot their password"), tr("Élèves → icône clé : générez un nouveau mot de passe provisoire, puis imprimez sa carte d'identifiants.", "التلاميذ ← أيقونة المفتاح: أنشئ كلمة مرور مؤقتة جديدة ثم اطبع بطاقته.", "Students → key icon: generate a new temporary password, then print their card.")],
    [tr("Préparer la nouvelle année", "تحضير السنة الجديدة", "Preparing the new year"), tr("Gestion des classes → « Dupliquer » copie cours, exercices et quiz ; « Archiver » range l'ancienne classe sans rien perdre.", "إدارة الأقسام ← « نسخ » ينسخ الدروس والتمارين والاختبارات؛ « أرشفة » يحفظ القسم القديم دون فقدان شيء.", "Manage classes → “Duplicate” copies courses, exercises and quizzes; “Archive” keeps the old class.")],
    [tr("Renouveler mon abonnement", "تجديد اشتراكي", "Renewing my subscription"), tr("Abonnement → choisissez une offre, payez puis envoyez la photo du reçu. Votre facture est disponible après validation.", "الاشتراك ← اختر عرضا وأدِّ ثم أرسل صورة الوصل. تتوفر فاتورتك بعد المصادقة.", "Subscription → pick a plan, pay, then send the receipt photo. Your invoice is available once approved.")],
  ];
  const ticket = tickets?.find(t => t.id === current) || null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><LifeBuoy className="h-6 w-6 text-muted-foreground" />{tr("Aide et support", "المساعدة والدعم", "Help & support")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Posez votre question à l'équipe : la réponse arrive ici et dans vos notifications.", "اطرح سؤالك على الفريق: يصلك الرد هنا وفي إشعاراتك.", "Ask the team: the answer arrives here and in your notifications.")}</p>
        </div>
        <Button className="gap-1.5" onClick={() => { setCreating(true); setCurrent(null); }} disabled={missing}><Plus className="h-4 w-4" />{tr("Nouvelle demande", "طلب جديد", "New request")}</Button>
      </div>

      {missing && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{tr("Le support sera disponible après la mise à jour de la base de données (migration 20261107090000).", "سيتوفر الدعم بعد تحديث قاعدة البيانات.", "Support will be available after the database update.")}</p>}

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-2">
          <h2 className="text-sm font-semibold">{tr("Mes demandes", "طلباتي", "My requests")}</h2>
          {(tickets || []).length === 0 && <p className="text-sm text-muted-foreground">{tr("Aucune demande.", "لا توجد طلبات.", "No request.")}</p>}
          <ul className="space-y-1.5">
            {(tickets || []).map(t => (
              <li key={t.id}>
                <button type="button" onClick={() => { setCurrent(t.id); setCreating(false); }}
                  className={cn("w-full rounded-lg border px-3 py-2 text-start text-sm hover:bg-muted", current === t.id && "border-primary bg-muted")}>
                  <span className="block truncate font-medium">{t.subject}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className={cn("rounded-full px-2", ticketStatusTone(t.status))}>{ticketStatusLabel(t.status, tr)}</span>
                    {new Date(t.updated_at).toLocaleDateString(locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="rounded-xl border bg-card p-4">
          {creating ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <div className="space-y-1.5"><Label htmlFor="sp-subject">{tr("Sujet", "الموضوع", "Subject")}</Label><Input id="sp-subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} /></div>
                <div className="space-y-1.5">
                  <Label htmlFor="sp-cat">{tr("Type", "النوع", "Type")}</Label>
                  <select id="sp-cat" value={category} onChange={e => setCategory(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="question">{tr("Question", "سؤال", "Question")}</option>
                    <option value="bug">{tr("Problème", "مشكلة", "Bug")}</option>
                    <option value="payment">{tr("Paiement", "الأداء", "Payment")}</option>
                    <option value="idea">{tr("Suggestion", "اقتراح", "Idea")}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="sp-body">{tr("Message", "الرسالة", "Message")}</Label><Textarea id="sp-body" rows={5} value={body} onChange={e => setBody(e.target.value)} maxLength={5000} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreating(false)}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
                <Button onClick={create} disabled={subject.trim().length < 2 || !body.trim()}>{tr("Envoyer", "إرسال", "Send")}</Button>
              </div>
            </div>
          ) : ticket ? (
            <SupportThread ticket={ticket} staff={false} tr={tr} locale={locale} onChanged={load} />
          ) : (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">{tr("Questions fréquentes", "أسئلة شائعة", "Frequent questions")}</h2>
              {FAQ.map(([q, a]) => (
                <details key={q} className="rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">{q}</summary>
                  <p className="mt-2 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
