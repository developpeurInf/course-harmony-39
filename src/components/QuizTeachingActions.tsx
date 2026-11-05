/**
 * Actions du professeur sur un quiz : remédiation en un clic (nouveau quiz avec les
 * questions les moins réussies, envoyé aux élèves sous le seuil) et lancement en direct.
 */
import { useState } from "react";
import { Loader2, Radio, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Tr = (fr: string, ar: string, en: string) => string;

export function QuizTeachingActions({ examId, roomId, passPct, hasResults, hasQuestions, tr }: {
  examId: string;
  roomId: string | null;
  passPct: number;
  hasResults: boolean;
  hasQuestions: boolean;
  tr: Tr;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scoreMax, setScoreMax] = useState(Math.round(passPct));
  const [successMax, setSuccessMax] = useState(60);
  const [maxQ, setMaxQ] = useState(8);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);

  const createRemediation = async () => {
    if (busy) return;
    if (!accessStore.guard("quiz.remediation")) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_remediation_quiz", {
        p_exam_id: examId, p_score_max: scoreMax, p_success_max: successMax, p_max: maxQ,
      });
      if (error) throw error;
      setOpen(false);
      toast.success(
        tr(`Quiz de remédiation créé : ${data.questions} question(s), ${data.students} élève(s) prévenu(s).`,
          `تم إنشاء اختبار الدعم: ${data.questions} سؤال، وإشعار ${data.students} تلميذ.`,
          `Remediation quiz created: ${data.questions} question(s), ${data.students} student(s) notified.`),
        { action: { label: tr("Ouvrir", "فتح", "Open"), onClick: () => navigate(`/exams?quiz=${data.exam_id}`) } }
      );
    } catch (e: any) {
      const m = String(e?.message || "");
      toast.error(
        m.includes("NO_WEAK_QUESTIONS")
          ? tr("Aucune question n'est sous le seuil de réussite choisi.", "لا يوجد سؤال تحت عتبة النجاح المختارة.", "No question is below the chosen success threshold.")
          : /function|schema cache/i.test(m)
            ? tr("Fonction disponible après la mise à jour de la base de données.", "الميزة متاحة بعد تحديث قاعدة البيانات.", "Available after the database update.")
            : tr("Création impossible.", "تعذر الإنشاء.", "Unable to create.")
      );
    } finally {
      setBusy(false);
    }
  };

  const startLive = async () => {
    if (!roomId || starting) return;
    if (!accessStore.guard("quiz.live")) return;
    setStarting(true);
    try {
      // Une seule session ouverte par quiz : on termine les anciennes
      await (supabase as any).from("live_sessions").update({ state: "ended", ended_at: new Date().toISOString() }).eq("exam_id", examId).neq("state", "ended");
      const { data, error } = await (supabase as any).from("live_sessions").insert({ exam_id: examId, room_id: roomId }).select("id").single();
      if (error) throw error;
      navigate(`/live/${data.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(/relation|schema cache|does not exist/i.test(String(e?.message))
        ? tr("Quiz en direct disponible après la mise à jour de la base de données.", "الاختبار المباشر متاح بعد تحديث قاعدة البيانات.", "Live quiz available after the database update.")
        : tr("Impossible de lancer le quiz en direct.", "تعذر إطلاق الاختبار المباشر.", "Unable to start the live quiz."));
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={startLive} disabled={!roomId || !hasQuestions || starting} className="gap-1.5 rounded-xl"
        title={tr("Projeter le quiz en classe, les élèves répondent sur leur téléphone", "اعرض الاختبار في القسم ويجيب التلاميذ من هواتفهم", "Project the quiz in class, students answer on their phones")}>
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}{tr("En direct", "مباشر", "Live")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!hasResults} className="gap-1.5 rounded-xl"
        title={tr("Nouveau quiz avec les questions les moins réussies", "اختبار جديد بالأسئلة الأقل نجاحاً", "New quiz with the least successful questions")}>
        <Stethoscope className="h-4 w-4" />{tr("Remédiation", "الدعم", "Remediation")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Quiz de remédiation", "اختبار الدعم", "Remediation quiz")}</DialogTitle>
            <DialogDescription>
              {tr("Un nouveau quiz est créé dans le même cours avec les questions les moins réussies. Les élèves sous le seuil reçoivent une notification.",
                "يُنشأ اختبار جديد في نفس الدرس بالأسئلة الأقل نجاحاً، ويتوصل التلاميذ تحت العتبة بإشعار.",
                "A new quiz is created in the same course with the least successful questions. Students below the threshold are notified.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">{tr("Questions réussies par moins de (%)", "أسئلة نجح فيها أقل من (%)", "Questions answered correctly by less than (%)")}</Label>
              <Input type="number" min={1} max={100} className="w-20" value={successMax} onChange={(e) => setSuccessMax(Math.min(100, Math.max(1, Number(e.target.value) || 60)))} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">{tr("Nombre maximum de questions", "العدد الأقصى للأسئلة", "Maximum number of questions")}</Label>
              <Input type="number" min={1} max={50} className="w-20" value={maxQ} onChange={(e) => setMaxQ(Math.min(50, Math.max(1, Number(e.target.value) || 8)))} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">{tr("Prévenir les élèves sous (% de la note)", "إشعار التلاميذ تحت (% من النقطة)", "Notify students below (% of the score)")}</Label>
              <Input type="number" min={1} max={100} className="w-20" value={scoreMax} onChange={(e) => setScoreMax(Math.min(100, Math.max(1, Number(e.target.value) || 50)))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={createRemediation} disabled={busy} className="gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Créer le quiz", "إنشاء الاختبار", "Create the quiz")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
