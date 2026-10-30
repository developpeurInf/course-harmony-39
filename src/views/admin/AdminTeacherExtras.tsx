import { useEffect, useMemo, useState } from "react";
import { BookOpen, Bot, ClipboardList, Eye, EyeOff, GraduationCap, Layers, Pin, PinOff, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ALWAYS_ON_MODULES, MODULE_LABELS, moduleKeys } from "@/lib/permissions";
import { db, fmtDate, useT } from "./adminShared";
import type { ConfirmOptions } from "./ConfirmDialog";

/** Onglet « Activité » : usage réel du prof + aperçu des modules qu'il voit */
export function ActivityTab({ teacherId }: { teacherId: string }) {
  const { L, lang } = useT();
  const [act, setAct] = useState<any>(null);
  const [allowed, setAllowed] = useState<Set<string> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data, error: e1 }, { data: eff }] = await Promise.all([
        db.rpc("admin_teacher_activity", { p_teacher: teacherId }),
        db.rpc("effective_permissions", { uid: teacherId }),
      ]);
      if (e1) setError(e1.message);
      setAct(data || null);
      setAllowed(new Set(((eff || []) as any[]).filter(r => r.allowed).map(r => r.key)));
    })();
  }, [teacherId]);

  const modules = useMemo(() => {
    if (!allowed) return [];
    return Object.keys(MODULE_LABELS)
      .filter(m => !ALWAYS_ON_MODULES.includes(m) && m !== "notifications")
      .map(m => {
        const keys = moduleKeys(m);
        const on = keys.filter(k => allowed.has(k)).length;
        return { m, total: keys.length, on };
      });
  }, [allowed]);

  if (error) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{L("Activité indisponible : appliquez la migration « outils d'administration ».", "النشاط غير متاح: طبّق ترحيل « أدوات الإدارة ».", "Activity unavailable: apply the “admin tools” migration.")} ({error})</p>;
  }
  if (!act) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  const tiles = [
    { icon: Layers, label: L("Classes", "الأقسام", "Classes"), value: act.classes },
    { icon: Users, label: L("Élèves", "التلاميذ", "Students"), value: act.students },
    { icon: BookOpen, label: L("Cours", "الدروس", "Courses"), value: act.courses },
    { icon: ClipboardList, label: L("Exercices", "التمارين", "Exercises"), value: act.exercises },
    { icon: GraduationCap, label: L("Quiz et examens", "الاختبارات والامتحانات", "Quizzes & exams"), value: act.quizzes },
    { icon: Send, label: L("Copies reçues (30 j)", "أوراق مستلمة (30 يوما)", "Submissions (30 d)"), value: act.submissions_30 },
    { icon: Bot, label: L("Appels IA ce mois", "طلبات الذكاء الاصطناعي هذا الشهر", "AI calls this month"), value: `${act.ai_month} · ${Number(act.ai_tokens_month || 0).toLocaleString()} tk` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(t => (
          <div key={t.label} className="rounded-xl border bg-card p-3">
            <t.icon className="mb-1 h-4 w-4 text-muted-foreground" />
            <p className="text-lg font-semibold tabular-nums">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">{L("Dernier cours créé", "آخر درس", "Last course created")}</p>
          <p className="mt-1 text-sm font-semibold">{act.last_course_at ? fmtDate(act.last_course_at, lang) : "—"}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{L("Ses classes", "أقسامه", "Their classes")}</h2>
        {(act.rooms || []).length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{L("Aucune classe.", "لا توجد أقسام.", "No class.")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {act.rooms.map((r: any) => (
              <li key={r.id} className="flex justify-between gap-2 px-4 py-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{L(`${r.students} élèves · ${r.courses} cours`, `${r.students} تلميذ · ${r.courses} درس`, `${r.students} students · ${r.courses} courses`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{L("Ce que voit ce professeur", "ما يراه هذا الأستاذ", "What this teacher sees")}</h2>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          {L("Aperçu du menu selon son offre et ses exceptions (les modules désactivés pour toute l'application restent masqués).", "معاينة القائمة حسب عرضه واستثناءاته (الوحدات المعطلة في التطبيق كله تبقى مخفية).", "Menu preview from their plan and exceptions (modules disabled app-wide stay hidden).")}
        </p>
        <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ m, total, on }) => {
            const label = MODULE_LABELS[m][lang];
            const state = on === 0 ? "off" : on === total ? "full" : "partial";
            return (
              <li key={m} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${state === "off" ? "opacity-50" : ""}`}>
                <span className="flex min-w-0 items-center gap-2">
                  {state === "off" ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0 text-emerald-600" />}
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {state === "off" ? L("Masqué", "مخفي", "Hidden") : state === "full" ? L("Complet", "كامل", "Full") : `${on}/${total}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Onglet « Notes internes » : visibles seulement par l'administration */
export function NotesTab({ teacherId, ask }: { teacherId: string; ask: (o: ConfirmOptions) => void }) {
  const { L, lang } = useT();
  const [notes, setNotes] = useState<any[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await db.from("teacher_notes").select("*").eq("teacher_id", teacherId)
      .order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setNotes([]);
      return;
    }
    setNotes(data || []);
    const ids = [...new Set((data || []).map((n: any) => n.created_by).filter(Boolean))];
    if (ids.length) {
      const { data: p } = await db.from("profiles").select("id, name").in("id", ids);
      const m: Record<string, string> = {};
      (p || []).forEach((x: any) => (m[x.id] = x.name));
      setNames(m);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const { error } = await db.from("teacher_notes").insert({ teacher_id: teacherId, body: text.trim() });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    load();
  };

  const pin = async (n: any) => {
    await db.from("teacher_notes").update({ pinned: !n.pinned }).eq("id", n.id);
    load();
  };

  const remove = (n: any) => ask({
    title: L("Supprimer cette note ?", "حذف هذه الملاحظة؟", "Delete this note?"),
    destructive: true,
    confirmLabel: L("Supprimer", "حذف", "Delete"),
    onConfirm: async () => {
      const { error } = await db.from("teacher_notes").delete().eq("id", n.id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      setNotes(list => (list || []).filter(x => x.id !== n.id));
    },
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-3">
        <Textarea rows={3} value={text} onChange={e => setText(e.target.value)} maxLength={2000}
          placeholder={L("Appel du 12/10 : souhaite passer à l'offre annuelle en janvier…", "مكالمة 12/10: يرغب في الانتقال إلى العرض السنوي في يناير…", "Call on 12/10: wants the yearly plan in January…")}
          aria-label={L("Nouvelle note", "ملاحظة جديدة", "New note")} />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={add} disabled={saving || !text.trim()}>{L("Ajouter la note", "إضافة الملاحظة", "Add note")}</Button>
        </div>
      </div>
      {notes === null ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L("Aucune note. Les notes ne sont visibles que par l'administration.", "لا توجد ملاحظات. الملاحظات مرئية للإدارة فقط.", "No note. Notes are only visible to admins.")}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id} className={`rounded-xl border p-3 text-sm ${n.pinned ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "bg-card"}`}>
              <p className="whitespace-pre-line">{n.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{fmtDate(n.created_at, lang)}{n.created_by && names[n.created_by] ? ` · ${names[n.created_by]}` : ""}</span>
                <span className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => pin(n)} aria-label={n.pinned ? L("Détacher", "إلغاء التثبيت", "Unpin") : L("Épingler", "تثبيت", "Pin")}>
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(n)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lien WhatsApp (numéro marocain 06… → 2126…) */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "212" + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}
