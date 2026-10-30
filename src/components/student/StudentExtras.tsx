/**
 * Fiche élève (côté professeur) : historique des transferts, notes privées,
 * lien parents en lecture seule.
 */
import { useEffect, useState } from "react";
import { ArrowRightLeft, Copy, Link2, Lock, Share2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { accessStore, useAccess } from "@/contexts/AccessContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const db = supabase as any;
type Tr = (fr: string, ar: string, en: string) => string;

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export function parentLinkUrl(token: string) {
  return `${window.location.origin}/parent?t=${token}`;
}

export function StudentExtras({ studentId, studentName, tr, locale }: { studentId: string; studentName: string; tr: Tr; locale: string }) {
  const { settings } = useAppSettings();
  const { can } = useAccess();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<any[] | null>(null);
  const [text, setText] = useState("");
  const [links, setLinks] = useState<any[]>([]);
  const day = (d: string) => new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });

  const loadNotes = () => db.from("student_notes").select("*").eq("student_id", studentId).order("created_at", { ascending: false })
    .then(({ data, error }: any) => setNotes(error ? [] : data || []));
  const loadLinks = () => db.from("parent_links").select("*").eq("student_id", studentId).is("revoked_at", null).order("created_at", { ascending: false })
    .then(({ data }: any) => setLinks(data || []));

  useEffect(() => {
    db.from("student_transfers").select("*").eq("student_id", studentId).order("transferred_at", { ascending: false })
      .then(async ({ data }: any) => {
        setTransfers(data || []);
        const ids = [...new Set((data || []).flatMap((t: any) => [t.from_room_id, t.to_room_id]).filter(Boolean))];
        if (ids.length) {
          const { data: r } = await db.from("rooms").select("id, name").in("id", ids);
          const m: Record<string, string> = {};
          (r || []).forEach((x: any) => (m[x.id] = x.name));
          setRoomNames(m);
        }
      });
    loadNotes();
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const addNote = async () => {
    if (!text.trim()) return;
    const { error } = await db.from("student_notes").insert({ student_id: studentId, body: text.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    loadNotes();
  };
  const removeNote = async (id: string) => {
    await db.from("student_notes").delete().eq("id", id);
    loadNotes();
  };

  const newLink = async () => {
    if (!accessStore.guard("parents.links")) return;
    const { data, error } = await db.rpc("create_parent_link", { p_student: studentId, p_days: 365 });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (await copy(parentLinkUrl(data))) toast.success(tr("Lien créé et copié", "تم إنشاء الرابط ونسخه", "Link created and copied"));
    loadLinks();
  };
  const revoke = async (token: string) => {
    await db.from("parent_links").update({ revoked_at: new Date().toISOString() }).eq("token", token);
    toast.success(tr("Lien désactivé", "تم تعطيل الرابط", "Link disabled"));
    loadLinks();
  };
  const waText = (token: string) => tr(
    `Bonjour, voici le suivi scolaire de ${studentName} (notes, absences, devoirs) : ${parentLinkUrl(token)}`,
    `مرحبا، هذا رابط تتبع ${studentName} الدراسي (النقط، الغياب، الواجبات): ${parentLinkUrl(token)}`,
    `Hello, here is ${studentName}'s school follow-up (grades, absences, homework): ${parentLinkUrl(token)}`
  );

  return (
    <div className="mt-5 space-y-4 border-t pt-4">
      {settings.features.parents !== false && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="h-4 w-4" />{tr("Lien parents", "رابط الآباء", "Parent link")}</h3>
            <Button size="sm" variant="outline" onClick={newLink} disabled={!can("parents.links")}>{tr("Nouveau lien", "رابط جديد", "New link")}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{tr("Les parents voient les notes, absences, devoirs et appréciations, sans compte, et peuvent vous écrire.", "يرى الآباء النقط والغياب والواجبات والملاحظات بدون حساب، ويمكنهم مراسلتك.", "Parents see grades, absences, homework and comments, without an account, and can write to you.")}</p>
          {links.map(l => (
            <div key={l.token} className="flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {tr("Créé le", "أنشئ في", "Created")} {day(l.created_at)} · {tr(`${l.views} consultation(s)`, `${l.views} مشاهدة`, `${l.views} view(s)`)}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={tr("Copier le lien", "نسخ الرابط", "Copy link")}
                onClick={async () => { if (await copy(parentLinkUrl(l.token))) toast.success(tr("Lien copié", "تم نسخ الرابط", "Link copied")); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                <a href={`https://wa.me/?text=${encodeURIComponent(waText(l.token))}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><Share2 className="h-3.5 w-3.5" /></a>
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => revoke(l.token)} aria-label={tr("Désactiver le lien", "تعطيل الرابط", "Disable link")}><XCircle className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          ))}
        </section>
      )}

      {can("student.notes") && <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-4 w-4" />{tr("Notes privées", "ملاحظات خاصة", "Private notes")}</h3>
        <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} maxLength={4000}
          placeholder={tr("Visible par vous seul : comportement, rendez-vous avec les parents…", "مرئية لك وحدك: السلوك، موعد مع الآباء…", "Only you can see it: behaviour, parent meeting…")}
          aria-label={tr("Nouvelle note privée", "ملاحظة خاصة جديدة", "New private note")} />
        <div className="flex justify-end"><Button size="sm" onClick={addNote} disabled={!text.trim()}>{tr("Ajouter", "إضافة", "Add")}</Button></div>
        {(notes || []).map(n => (
          <div key={n.id} className="rounded-lg border bg-muted/30 p-2 text-sm">
            <p className="whitespace-pre-line">{n.body}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{day(n.created_at)}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeNote(n.id)} aria-label={tr("Supprimer la note", "حذف الملاحظة", "Delete note")}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </section>}

      {transfers.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ArrowRightLeft className="h-4 w-4" />{tr("Historique des transferts", "سجل التحويلات", "Transfer history")}</h3>
          <ul className="space-y-1 text-xs">
            {transfers.map(t => (
              <li key={t.id} className="flex justify-between gap-2 rounded-md border px-2 py-1.5">
                <span>{roomNames[t.from_room_id] || "—"} → {roomNames[t.to_room_id] || "—"}</span>
                <span className="text-muted-foreground">{day(t.transferred_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
