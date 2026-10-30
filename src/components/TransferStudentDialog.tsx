/**
 * Changer un élève de classe : la fonction SQL transfer_student déplace le profil,
 * les inscriptions et les données de suivi (présences, groupe, appréciations, notes du
 * carnet, activité). Ses copies de quiz et d'exercices restent attachées aux évaluations
 * de l'ancienne classe, qui ne le compte plus.
 */
import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";

type Lang = "fr" | "ar" | "en";

export default function TransferStudentDialog({
  student, currentRoomId, rooms, language, onClose, onDone,
}: {
  student: { id: string; name: string } | null;
  currentRoomId: string;
  rooms: { id: string; name: string }[];
  language: Lang;
  onClose: () => void;
  onDone: (studentId: string, toRoomId: string) => void;
}) {
  const L = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const targets = rooms.filter((r) => r.id !== currentRoomId);
  const [toRoom, setToRoom] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (student) setToRoom(targets[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const submit = async () => {
    if (!student || !toRoom || busy) return;
    if (!accessStore.guard("student.edit")) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("transfer_student", { p_student: student.id, p_to_room: toRoom });
    setBusy(false);
    if (error) {
      const missing = /transfer_student|schema cache|does not exist/i.test(error.message || "");
      toast.error(missing
        ? L("Fonction absente : exécutez la migration 20261103090000_student_transfer.sql dans Supabase.", "الوظيفة غير موجودة: نفّذ ترحيل 20261103090000_student_transfer.sql في Supabase.", "Missing function: run migration 20261103090000_student_transfer.sql in Supabase.")
        : L(`Changement impossible : ${error.message}`, `تعذر التغيير: ${error.message}`, `Could not move the student: ${error.message}`));
      return;
    }
    const target = targets.find((r) => r.id === toRoom)?.name || "";
    const n = (k: string) => Number(data?.[k] || 0);
    const parts = [
      n("attendance") && L(`${n("attendance")} présence(s)`, `${n("attendance")} حضور`, `${n("attendance")} attendance row(s)`),
      n("gradebook_marks") && L(`${n("gradebook_marks")} note(s)`, `${n("gradebook_marks")} نقطة`, `${n("gradebook_marks")} mark(s)`),
      n("appreciations") && L(`${n("appreciations")} appréciation(s)`, `${n("appreciations")} ملاحظة`, `${n("appreciations")} comment(s)`),
    ].filter(Boolean);
    toast.success(
      L(`${student.name} est maintenant en ${target}`, `${student.name} الآن في ${target}`, `${student.name} is now in ${target}`)
      + (parts.length ? ` · ${parts.join(", ")}` : "")
    );
    onDone(student.id, toRoom);
  };

  return (
    <Dialog open={!!student} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" />{L("Changer de classe", "تغيير القسم", "Move to another class")}</DialogTitle>
          <DialogDescription>
            {L(
              `${student?.name || ""} quitte cette classe avec ses présences, son groupe, ses appréciations, ses notes du carnet et son activité. Ses copies de quiz et d'exercices restent dans son historique, mais ne comptent plus ici.`,
              `${student?.name || ""} يغادر هذا القسم مع حضوره ومجموعته وملاحظاته ونقطه ونشاطه. تبقى أوراق اختباراته وتمارينه في سجله لكنها لا تُحتسب هنا.`,
              `${student?.name || ""} leaves this class with attendance, group, comments, gradebook marks and activity. Quiz and exercise submissions stay in their history but no longer count here.`
            )}
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L("Vous n'avez pas d'autre classe.", "ليس لديك قسم آخر.", "You have no other class.")}</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="transfer-room">{L("Nouvelle classe", "القسم الجديد", "New class")}</Label>
            <select id="transfer-room" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={toRoom} onChange={(e) => setToRoom(e.target.value)}>
              {targets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={() => void submit()} disabled={busy || !toRoom} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            {L("Changer de classe", "تغيير القسم", "Move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
