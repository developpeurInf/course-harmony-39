/**
 * « À faire aujourd'hui » : copies à corriger, appel non fait, quiz qui se ferment
 * sous 48 h, élèves en alerte (seuils réglables). Données : rpc teacher_today.
 * Invisible tant que la migration n'est pas appliquée.
 */
import { useEffect, useState } from "react";
import { AlarmClock, CalendarCheck, ClipboardList, FileCheck2, Settings2, TrendingDown, UserX } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getUserPrefs, saveUserPrefs } from "@/lib/userPrefs";

const db = supabase as any;

interface Today {
  copies: number;
  short_answers: number;
  closing: { id: string; title: string; until: string; course_id: string }[];
  attendance: { id: string; name: string }[];
  inactive: { id: string; name: string; room: string }[];
  low: { id: string; name: string; avg: number }[];
  thresholds: { inactiveDays: number; minAverage: number };
}

export function TodayCard() {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const [d, setD] = useState<Today | null>(null);
  const [key, setKey] = useState(0);
  const [days, setDays] = useState("7");
  const [avg, setAvg] = useState("8");

  useEffect(() => {
    let alive = true;
    db.rpc("teacher_today").then(({ data, error }: any) => {
      if (!alive || error || !data || data.copies === undefined) return;
      setD(data as Today);
      setDays(String(data.thresholds?.inactiveDays ?? 7));
      setAvg(String(data.thresholds?.minAverage ?? 8));
    });
    return () => {
      alive = false;
    };
  }, [key]);

  if (!d) return null;
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
  const hour = (s: string) => new Date(s).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const saveThresholds = async () => {
    const p = await getUserPrefs();
    const inactiveDays = Math.min(60, Math.max(1, Number(days) || 7));
    const minAverage = Math.min(20, Math.max(0, Number(String(avg).replace(",", ".")) || 8));
    const ok = await saveUserPrefs({ ...p, alerts: { inactiveDays, minAverage } });
    if (ok) {
      toast.success(tr("Seuils enregistrés", "تم حفظ العتبات", "Thresholds saved"));
      setKey(k => k + 1);
    }
  };

  const nothing = !d.copies && !d.short_answers && !d.closing.length && !d.attendance.length && !d.inactive.length && !d.low.length;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{tr("À faire aujourd'hui", "مهام اليوم", "To do today")}</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"><Settings2 className="h-3.5 w-3.5" />{tr("Seuils d'alerte", "عتبات التنبيه", "Alert thresholds")}</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="th-days" className="text-xs">{tr("Élève inactif après (jours)", "تلميذ غير نشط بعد (أيام)", "Student inactive after (days)")}</Label>
              <Input id="th-days" type="number" min={1} max={60} value={days} onChange={e => setDays(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="th-avg" className="text-xs">{tr("Moyenne aux quiz en dessous de (/20)", "معدل الاختبارات أقل من (/20)", "Quiz average below (/20)")}</Label>
              <Input id="th-avg" inputMode="decimal" value={avg} onChange={e => setAvg(e.target.value)} />
            </div>
            <Button size="sm" className="w-full" onClick={saveThresholds}>{tr("Enregistrer", "حفظ", "Save")}</Button>
          </PopoverContent>
        </Popover>
      </div>

      {nothing ? (
        <p className="text-sm text-muted-foreground">{tr("Rien d'urgent aujourd'hui.", "لا شيء مستعجل اليوم.", "Nothing urgent today.")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(d.copies > 0 || d.short_answers > 0) && (
            <div className="space-y-1.5 rounded-lg border p-3">
              {d.copies > 0 && (
                <Link to="/exercises" className="flex items-center gap-2 text-sm hover:underline">
                  <FileCheck2 className="h-4 w-4 text-primary" />{tr(`${d.copies} copie(s) d'exercice à corriger`, `${d.copies} ورقة تمرين للتصحيح`, `${d.copies} exercise cop(ies) to grade`)}
                </Link>
              )}
              {d.short_answers > 0 && (
                <Link to="/exams" className="flex items-center gap-2 text-sm hover:underline">
                  <ClipboardList className="h-4 w-4 text-primary" />{tr(`${d.short_answers} réponse(s) courte(s) à corriger`, `${d.short_answers} إجابة قصيرة للتصحيح`, `${d.short_answers} short answer(s) to grade`)}
                </Link>
              )}
            </div>
          )}
          {d.attendance.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-medium"><CalendarCheck className="h-4 w-4 text-amber-600" />{tr("Appel pas encore fait", "لم يُسجَّل الحضور بعد", "Attendance not taken yet")}</p>
              <div className="flex flex-wrap gap-1.5">
                {d.attendance.map(r => (
                  <Link key={r.id} to={`/rooms/${r.id}/attendance`} className="rounded-md border px-2 py-0.5 text-xs hover:bg-muted">{r.name}</Link>
                ))}
              </div>
            </div>
          )}
          {d.closing.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-medium"><AlarmClock className="h-4 w-4 text-amber-600" />{tr("Se ferment dans les 48 h", "تُغلق خلال 48 ساعة", "Closing within 48 h")}</p>
              <ul className="space-y-1 text-sm">
                {d.closing.map(x => (
                  <li key={x.id} className="flex justify-between gap-2">
                    <Link to={`/exams?course=${x.course_id}`} className="truncate hover:underline">{x.title}</Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{hour(x.until)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(d.inactive.length > 0 || d.low.length > 0) && (
            <div className="rounded-lg border p-3">
              {d.inactive.length > 0 && (
                <>
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium"><UserX className="h-4 w-4 text-destructive" />
                    {tr(`Sans connexion depuis ${d.thresholds.inactiveDays} j`, `بدون اتصال منذ ${d.thresholds.inactiveDays} يوما`, `No login for ${d.thresholds.inactiveDays} days`)} ({d.inactive.length})
                  </p>
                  <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{d.inactive.map(s => s.name).join(", ")}</p>
                </>
              )}
              {d.low.length > 0 && (
                <>
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium"><TrendingDown className="h-4 w-4 text-destructive" />
                    {tr(`Moyenne < ${d.thresholds.minAverage}/20`, `معدل < ${d.thresholds.minAverage}/20`, `Average < ${d.thresholds.minAverage}/20`)} ({d.low.length})
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{d.low.map(s => `${s.name} (${String(s.avg).replace(".", language === "en" ? "." : ",")})`).join(", ")}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
