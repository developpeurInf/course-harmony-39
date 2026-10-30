import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const db = supabase as any;
type Tr = (fr: string, ar: string, en: string) => string;

/** Archiver une classe en fin d'année : masquée aux élèves, contenu et notes conservés */
export async function archiveRoom(roomId: string, archive: boolean, tr: Tr): Promise<boolean> {
  if (!accessStore.guard("class.duplicate")) return false;
  const { error } = await db.from("rooms")
    .update(archive ? { archived_at: new Date().toISOString(), is_visible: false } : { archived_at: null, is_visible: true })
    .eq("id", roomId);
  if (error) {
    toast.error(error.message);
    return false;
  }
  toast.success(archive
    ? tr("Classe archivée : elle est masquée aux élèves, tout est conservé", "تمت أرشفة القسم: أصبح مخفيا عن التلاميذ مع الاحتفاظ بكل شيء", "Class archived: hidden from students, everything is kept")
    : tr("Classe désarchivée", "تم إلغاء أرشفة القسم", "Class unarchived"));
  return true;
}

/** Dupliquer une classe pour l'année suivante : cours, supports, exercices, quiz et colonnes du carnet (sans les élèves) */
export function DuplicateRoomDialog({ room, onClose, onDone, tr }: {
  room: { id: string; name: string } | null;
  onClose: () => void;
  onDone: () => void;
  tr: Tr;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (room) setName(`${room.name} (${new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0)})`);
  }, [room]);

  const run = async () => {
    if (!room || !name.trim()) return;
    if (!accessStore.guard("class.duplicate")) return;
    setBusy(true);
    const { error } = await db.rpc("duplicate_room", { p_room: room.id, p_name: name.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Classe dupliquée : tout est masqué, publiez au fur et à mesure", "تم نسخ القسم: كل المحتوى مخفي، انشره تدريجيا", "Class duplicated: everything is hidden, publish as you go"));
    onClose();
    onDone();
  };

  return (
    <Dialog open={!!room} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5" />{tr("Dupliquer la classe", "نسخ القسم", "Duplicate the class")}</DialogTitle>
          <DialogDescription>
            {tr(
              "Copie les cours, supports, exercices, quiz et colonnes du carnet de notes, sans les élèves ni leurs copies. Tout est créé masqué et sans dates.",
              "ينسخ الدروس والدعامات والتمارين والاختبارات وأعمدة دفتر النقط، بدون التلاميذ وأوراقهم. كل شيء يُنشأ مخفيا وبدون تواريخ.",
              "Copies courses, materials, exercises, quizzes and gradebook columns, without students or their work. Everything is created hidden and undated."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dup-name">{tr("Nom de la nouvelle classe", "اسم القسم الجديد", "New class name")}</Label>
          <Input id="dup-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
          <p className="text-xs text-muted-foreground">{tr("Les fichiers sont partagés avec la classe d'origine : archivez-la plutôt que de la supprimer.", "الملفات مشتركة مع القسم الأصلي: قم بأرشفته بدل حذفه.", "Files are shared with the original class: archive it rather than delete it.")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={run} disabled={busy || !name.trim()} className="gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Dupliquer", "نسخ", "Duplicate")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
