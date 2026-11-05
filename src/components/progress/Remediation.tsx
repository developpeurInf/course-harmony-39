/** Exercices de remédiation générés par l'IA à partir des erreurs d'un quiz de l'élève */
import { useState } from "react";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MathText } from "@/components/math/MathContent";
import { aiErrorMessage, callTeacherAi } from "@/lib/teacherAi";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentFeatures } from "@/lib/studentFeatures";

type Tr = (fr: string, ar: string, en: string) => string;
interface Remediation {
  summary: string;
  exercises: { skill: string; statement: string; hint: string; answer: string }[];
}

export function RemediationButton({ submissionId, language, tr, size = "sm" }: { submissionId: string; language: string; tr: Tr; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Remediation | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const sf = useStudentFeatures(user?.id);

  const run = async () => {
    setOpen(true);
    if (data) return;
    setBusy(true);
    try {
      const r = await callTeacherAi<{ remediation: Remediation }>({ action: "remediation", submission_id: submissionId, language });
      setData(r.remediation);
    } catch (e: any) {
      toast.error(aiErrorMessage(String(e?.message || ""), tr));
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!sf?.remediation) return null;
  return (
    <>
      <Button size={size} variant="outline" className="gap-1.5" onClick={run}><Sparkles className="h-4 w-4 text-violet-600" />{tr("M'entraîner sur mes erreurs", "التدرب على أخطائي", "Practise my mistakes")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" />{tr("Exercices pour progresser", "تمارين للتقدم", "Exercises to improve")}</DialogTitle>
            <DialogDescription>{tr("Préparés par l'IA à partir de tes erreurs. Essaie d'abord seul, puis regarde l'indice et la correction.", "أعدها الذكاء الاصطناعي انطلاقا من أخطائك. حاول أولا وحدك ثم انظر إلى التلميح والتصحيح.", "Prepared by AI from your mistakes. Try alone first, then look at the hint and the answer.")}</DialogDescription>
          </DialogHeader>
          {busy || !data ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" />{tr("Préparation des exercices…", "جارٍ إعداد التمارين…", "Preparing exercises…")}</div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-lg bg-violet-50 p-3 text-sm dark:bg-violet-950/30"><MathText text={data.summary} /></p>
              {data.exercises.map((x, i) => (
                <div key={i} className="rounded-xl border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{i + 1}. {x.skill}</p>
                  <MathText text={x.statement} className="mt-1 block text-sm" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setShown(s => ({ ...s, [`h${i}`]: !s[`h${i}`] }))}><Lightbulb className="h-3.5 w-3.5" />{tr("Indice", "تلميح", "Hint")}</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShown(s => ({ ...s, [`a${i}`]: !s[`a${i}`] }))}>{tr("Correction", "التصحيح", "Answer")}</Button>
                  </div>
                  {shown[`h${i}`] && <p className="mt-1 rounded bg-amber-50 p-2 text-sm dark:bg-amber-950/30"><MathText text={x.hint} /></p>}
                  {shown[`a${i}`] && <p className="mt-1 whitespace-pre-line rounded bg-emerald-50 p-2 text-sm dark:bg-emerald-950/30"><MathText text={x.answer} /></p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
