/**
 * Labo 3D (AR / VR) : le professeur crée des scènes mathématiques à partir de modèles,
 * les partage à une classe (et à un cours) ; l'élève les ouvre en 3D, en réalité augmentée
 * ou en réalité virtuelle. Un bac à sable permet d'explorer librement chaque modèle.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Boxes, Copy, Eye, EyeOff, Library, Loader2, Pencil, Plus, Ruler, Save, Share2, Sparkles, Target, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NotInPlan } from "@/components/access/AccessUi";
import { Viewer3D } from "@/components/lab3d/Viewer3D";
import { ParamsForm } from "@/components/lab3d/ParamsForm";
import { LabLibrary } from "@/components/lab3d/LabLibrary";
import { LEVELS, SUBJECTS, type LabEntry, type LabLesson } from "@/lib/lab3d/catalog";
import { GROUP_LABELS, TEMPLATES, defaultParams, normalizeParams, templateById, type Params, type TemplateDef, type Tri } from "@/lib/lab3d/templates";
import { useLab3dFeatures } from "@/lib/lab3d/features";
import { accessStore } from "@/contexts/AccessContext";
import { cn } from "@/lib/utils";

const db = supabase as any;

export interface Lab3dScene {
  id: string; professor_id: string; title: string; description: string | null; template: string; params: Params;
  room_id: string | null; course_id: string | null; is_visible: boolean; views: number; created_at: string; updated_at: string;
  lab_id?: string | null;
}

type Tab = "library" | "scenes" | "templates";
const TAB_KEY = "lab3d.tab";

export default function Lab3D() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const f = useLab3dFeatures();
  const isStudent = user?.role === "student";

  const [scenes, setScenes] = useState<Lab3dScene[] | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string; room_id: string | null }[]>([]);
  const [editing, setEditing] = useState<Partial<Lab3dScene> | null>(null);
  const [sandbox, setSandbox] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState("all");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>(() => { try { const v = localStorage.getItem(TAB_KEY); return v === "scenes" || v === "templates" ? v : "library"; } catch { return "library"; } });
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* stockage indisponible */ } };
  const [openLab, setOpenLab] = useState<{ lab: LabEntry; lesson: LabLesson } | null>(null);

  const load = async () => {
    if (!user) return;
    let q = db.from("lab3d_scenes").select("*").order("updated_at", { ascending: false });
    if (!isStudent) q = q.eq("professor_id", user.id);
    const { data, error } = await q;
    if (error) { setScenes([]); return; }
    setScenes(data || []);
  };
  useEffect(() => {
    load();
    if (user && !isStudent) {
      supabase.from("rooms").select("id, name, archived_at").eq("professor_id", user.id).order("name")
        .then(({ data }: any) => setRooms((data || []).filter((r: any) => !r.archived_at)));
      supabase.from("courses").select("id, title, room_id").eq("professor_id", user.id).order("title")
        .then(({ data }: any) => setCourses(data || []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name;
  const courseTitle = (id: string | null) => courses.find((c) => c.id === id)?.title;
  const visibleScenes = useMemo(() => (scenes || []).filter((s) => roomFilter === "all" || (roomFilter === "none" ? !s.room_id : s.room_id === roomFilter)), [scenes, roomFilter]);

  if (!f) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!f.use) return <NotInPlan title={tr("Labo 3D (AR / VR)", "المختبر ثلاثي الأبعاد", "3D Lab (AR / VR)")} />;

  const save = async () => {
    if (!editing) return;
    if (!accessStore.guard("lab3d.use")) return;
    const title = (editing.title || "").trim();
    if (!title) { toast.error(tr("Donnez un titre à la scène.", "أعط عنوانا للمشهد.", "Give the scene a title.")); return; }
    const row = {
      title, description: editing.description?.trim() || null, template: editing.template!,
      params: normalizeParams(editing.template!, editing.params as Params), room_id: editing.room_id || null,
      course_id: editing.course_id || null, is_visible: !!editing.is_visible && !!editing.room_id, updated_at: new Date().toISOString(),
      lab_id: editing.lab_id || null,
    };
    const write = (r: Record<string, unknown>) => editing.id
      ? db.from("lab3d_scenes").update(r).eq("id", editing.id)
      : db.from("lab3d_scenes").insert(r);
    let res = await write(row);
    // base pas encore migrée (colonne lab_id absente) : on enregistre sans le lien vers la bibliothèque
    if (res.error && /lab_id/.test(res.error.message || "")) {
      const { lab_id: _omit, ...rest } = row;
      res = await write(rest);
    }
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(tr("Scène enregistrée", "تم حفظ المشهد", "Scene saved"));
    setEditing(null);
    load();
  };
  const toggleVisible = async (s: Lab3dScene) => {
    if (!s.room_id) { toast.error(tr("Choisissez d'abord une classe.", "اختر قسما أولا.", "Choose a class first.")); return; }
    const { error } = await db.from("lab3d_scenes").update({ is_visible: !s.is_visible }).eq("id", s.id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async (id: string) => {
    if (confirmDel !== id) { setConfirmDel(id); setTimeout(() => setConfirmDel((x) => (x === id ? null : x)), 4000); return; }
    const { error } = await db.from("lab3d_scenes").delete().eq("id", id);
    if (error) toast.error(error.message); else { setConfirmDel(null); load(); }
  };
  const newScene = (tpl: TemplateDef) => setEditing({ template: tpl.id, params: defaultParams(tpl.id), title: L(tpl.label), description: "", room_id: rooms[0]?.id || null, course_id: null, is_visible: false });
  const shareLab = (lab: LabEntry, params: Params) => setEditing({
    template: lab.template, params, title: L(lab.title), lab_id: lab.id,
    description: `${L(lab.goal)}\n\n${lab.steps.map((s, i) => `${i + 1}. ${L(s)}`).join("\n")}`,
    room_id: rooms[0]?.id || null, course_id: null, is_visible: false,
  });

  // ----------------------------------------------------------------- éditeur
  if (editing) {
    const tpl = templateById(editing.template!);
    const roomCourses = courses.filter((c) => !editing.room_id || c.room_id === editing.room_id);
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold"><span className="text-2xl">{tpl.icon}</span>{editing.id ? tr("Modifier la scène", "تعديل المشهد", "Edit the scene") : tr("Nouvelle scène", "مشهد جديد", "New scene")}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}><X className="me-1.5 h-4 w-4" />{tr("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={save}><Save className="me-1.5 h-4 w-4" />{tr("Enregistrer", "حفظ", "Save")}</Button>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Viewer3D template={editing.template!} params={editing.params as Params} ar={f.ar} vr={f.vr} height="min(62vh, 560px)" />
          <div className="space-y-4">
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div className="space-y-1.5"><Label className="text-xs">{tr("Titre", "العنوان", "Title")}</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{tr("Consigne pour les élèves", "تعليمات للتلاميذ", "Instructions for students")}</Label>
                <Textarea rows={3} placeholder={tr("Ex. : faites varier la hauteur de la section. Que remarquez-vous ?", "مثال: غير ارتفاع المقطع. ماذا تلاحظ؟", "E.g. change the height of the section. What do you notice?")} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label className="text-xs">{tr("Classe", "القسم", "Class")}</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={editing.room_id || ""} onChange={(e) => setEditing({ ...editing, room_id: e.target.value || null, course_id: null })}>
                    <option value="">{tr("Aucune (brouillon)", "بدون (مسودة)", "None (draft)")}</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">{tr("Cours (facultatif)", "الدرس (اختياري)", "Course (optional)")}</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={editing.course_id || ""} onChange={(e) => setEditing({ ...editing, course_id: e.target.value || null })}>
                    <option value="">—</option>
                    {roomCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <span>{tr("Visible par les élèves", "مرئي للتلاميذ", "Visible to students")}</span>
                <Switch checked={!!editing.is_visible} disabled={!editing.room_id} onCheckedChange={(c) => setEditing({ ...editing, is_visible: c })} />
              </label>
            </section>
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{tr("Réglages", "الإعدادات", "Settings")}</h2>
                <select className="h-8 rounded-md border bg-background px-2 text-xs" value={editing.template} onChange={(e) => setEditing({ ...editing, template: e.target.value, params: defaultParams(e.target.value) })}>
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.icon} {L(t.label)}</option>)}
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">{tr("Les réglages marqués « élève » restent modifiables par les élèves dans la visionneuse.", "الإعدادات المعلمة « تلميذ » يمكن للتلاميذ تغييرها.", "Settings marked “student” stay adjustable by students in the viewer.")}</p>
              <ParamsForm template={editing.template!} params={editing.params as Params} onChange={(p) => setEditing({ ...editing, params: p })} showStudentFlag />
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- bac à sable
  if (sandbox) {
    const tpl = templateById(sandbox);
    return <Sandbox key={sandbox} tpl={tpl} ar={f.ar} vr={f.vr} onClose={() => setSandbox(null)} onSave={isStudent ? undefined : (p) => setEditing({ template: tpl.id, params: p, title: L(tpl.label), description: "", room_id: rooms[0]?.id || null, course_id: null, is_visible: false })} />;
  }

  // ----------------------------------------------------------------- fiche d'un labo de la bibliothèque
  if (openLab) {
    return <LabSheet key={openLab.lab.id} lab={openLab.lab} lesson={openLab.lesson} ar={f.ar} vr={f.vr} onClose={() => setOpenLab(null)} onShare={isStudent ? undefined : (p) => shareLab(openLab.lab, p)} />;
  }

  // ----------------------------------------------------------------- accueil
  const groups = (["solids", "space", "analysis", "proba", "physics", "chemistry", "svt"] as const).map((g) => ({ g, items: TEMPLATES.filter((t) => t.group === g) })).filter((x) => x.items.length);
  const tabs: { id: Tab; icon: typeof Library; label: string }[] = [
    { id: "library", icon: Library, label: tr("Bibliothèque des labos", "مكتبة المختبرات", "Lab library") },
    { id: "scenes", icon: BookOpen, label: isStudent ? tr("Scènes de ma classe", "مشاهد قسمي", "My class's scenes") : tr("Mes scènes", "مشاهدي", "My scenes") },
    { id: "templates", icon: Sparkles, label: isStudent ? tr("Explorer librement", "استكشاف حر", "Explore freely") : tr("Modèles", "النماذج", "Templates") },
  ];
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Boxes className="h-6 w-6 text-muted-foreground" />{tr("Labo 3D · AR / VR", "المختبر ثلاثي الأبعاد", "3D Lab · AR / VR")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {isStudent
              ? tr("Des labos de maths, physique, chimie et SVT à manipuler en 3D, à poser sur votre table en réalité augmentée ou à visiter en réalité virtuelle.", "مختبرات في الرياضيات والفيزياء والكيمياء وعلوم الحياة والأرض للتجريب ثلاثي الأبعاد أو بالواقع المعزز أو الافتراضي.", "Math, physics, chemistry and biology labs to handle in 3D, place on your desk in AR or explore in VR.")
              : tr("Une bibliothèque de labos de maths, physique, chimie et SVT rangés par leçon du programme marocain (TC, 1re et 2e Bac). Choisissez un labo, adaptez-le et partagez-le à vos classes.", "مكتبة مختبرات في الرياضيات والفيزياء والكيمياء وعلوم الحياة والأرض مرتبة حسب دروس البرنامج المغربي. اختر مختبرا وكيفه وشاركه مع أقسامك.", "A library of math, physics, chemistry and biology labs organised by lesson of the Moroccan curriculum. Pick a lab, adapt it and share it with your classes.")}
          </p>
        </div>
        {f.measure && <Button asChild variant="outline"><Link to="/lab3d/measure"><Ruler className="me-1.5 h-4 w-4" />{tr("Mesurer le réel", "القياس في الواقع", "Measure the real world")}</Link></Button>}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm", tab === t.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}{t.id === "scenes" && scenes && scenes.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px]">{scenes.length}</span>}
          </button>
        ))}
      </div>

      {tab === "library" && <LabLibrary onOpen={(lab, lesson) => setOpenLab({ lab, lesson })} />}

      {tab === "scenes" && <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{isStudent ? tr("Scènes de ma classe", "مشاهد قسمي", "My class's scenes") : tr("Mes scènes", "مشاهدي", "My scenes")}</h2>
          {!isStudent && rooms.length > 0 && (
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="all">{tr("Toutes les classes", "كل الأقسام", "All classes")}</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              <option value="none">{tr("Brouillons", "مسودات", "Drafts")}</option>
            </select>
          )}
        </div>
        {scenes === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : visibleScenes.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {isStudent ? tr("Votre professeur n'a pas encore partagé de scène. Explorez la bibliothèque des labos !", "لم يشارك أستاذك أي مشهد بعد. استكشف مكتبة المختبرات!", "Your teacher hasn't shared a scene yet. Explore the lab library!")
              : tr("Aucune scène. Ouvrez un labo de la bibliothèque et partagez-le à une classe.", "لا توجد مشاهد. افتح مختبرا من المكتبة وشاركه مع قسم.", "No scene yet. Open a lab from the library and share it with a class.")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleScenes.map((s) => {
              const tpl = templateById(s.template);
              return (
                <div key={s.id} className="flex flex-col rounded-xl border bg-card p-4">
                  <Link to={`/lab3d/${s.id}`} className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">{tpl.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{L(tpl.label)}{!isStudent && ` · ${roomName(s.room_id) || tr("brouillon", "مسودة", "draft")}`}{s.course_id && courseTitle(s.course_id) ? ` · ${courseTitle(s.course_id)}` : ""}</p>
                      {s.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                    </div>
                  </Link>
                  {!isStudent && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", s.is_visible ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-muted text-muted-foreground")}>
                        {s.is_visible ? tr("Partagée", "مشارك", "Shared") : tr("Masquée", "مخفي", "Hidden")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{s.views} {tr("vue(s)", "مشاهدة", "view(s)")}</span>
                      <div className="ms-auto flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title={s.is_visible ? tr("Masquer", "إخفاء", "Hide") : tr("Partager", "مشاركة", "Share")} onClick={() => toggleVisible(s)}>{s.is_visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title={tr("Modifier", "تعديل", "Edit")} onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title={tr("Dupliquer", "نسخ", "Duplicate")} onClick={() => setEditing({ ...s, id: undefined, title: `${s.title} (2)`, is_visible: false })}><Copy className="h-4 w-4" /></Button>
                        <Button size="icon" variant={confirmDel === s.id ? "destructive" : "ghost"} className="h-8 w-8" title={confirmDel === s.id ? tr("Cliquez encore pour supprimer", "انقر مرة أخرى للحذف", "Click again to delete") : tr("Supprimer", "حذف", "Delete")} onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>}

      {tab === "templates" && <section className="space-y-4">
        <p className="text-sm text-muted-foreground">{tr("Chaque modèle est un simulateur complet : ouvrez-le pour l'explorer ou créez une scène sur mesure.", "كل نموذج محاكي كامل: افتحه للاستكشاف أو أنشئ مشهدا خاصا.", "Each template is a full simulator: open it to explore or build a custom scene.")}</p>
        {groups.map(({ g, items }) => (
          <div key={g} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{L(GROUP_LABELS[g])}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {items.map((t) => (
                <div key={t.id} className="group flex items-start gap-3 rounded-xl border bg-card p-3">
                  <span className="text-2xl">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{L(t.label)}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{L(t.desc)}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{t.level}</p>
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => setSandbox(t.id)}>{tr("Explorer", "استكشاف", "Explore")}</Button>
                      {!isStudent && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => newScene(t)}><Plus className="me-1 h-3.5 w-3.5" />{tr("Créer une scène", "إنشاء مشهد", "Create a scene")}</Button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>}
    </div>
  );
}

function LabSheet({ lab, lesson, ar, vr, onClose, onShare }: { lab: LabEntry; lesson: LabLesson; ar: boolean; vr: boolean; onClose: () => void; onShare?: (p: Params) => void }) {
  const { language } = useLanguage();
  const tr = (fr: string, a: string, en: string) => (language === "ar" ? a : language === "en" ? en : fr);
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const tpl = templateById(lab.template);
  const start = () => normalizeParams(lab.template, { ...defaultParams(lab.template), ...(lab.params || {}) });
  const [p, setP] = useState<Params>(start);
  const [done, setDone] = useState<number[]>([]);
  const subject = SUBJECTS.find((s) => s.id === lesson.subject)!;
  const level = LEVELS.find((l) => l.id === lesson.level)!;
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"><ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />{tr("Bibliothèque", "المكتبة", "Library")}</button>
          <p className="mt-1 text-xs text-muted-foreground">{subject.icon} {L(subject.label)} · {L(level.label)} · {L(lesson.title)}</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><span className="text-2xl">{tpl.icon}</span>{L(lab.title)}</h1>
        </div>
        {onShare && <Button onClick={() => onShare(p)}><Share2 className="me-1.5 h-4 w-4" />{tr("Partager à une classe", "مشاركة مع قسم", "Share with a class")}</Button>}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Viewer3D template={lab.template} params={p} ar={ar} vr={vr} height="min(64vh, 600px)" />
        <div className="space-y-4">
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <p className="flex items-start gap-2 text-sm"><Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><span className="font-medium">{tr("Objectif", "الهدف", "Goal")} : </span>{L(lab.goal)}</span></p>
            <ol className="space-y-2">
              {lab.steps.map((s, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={done.includes(i)} onChange={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} />
                    <span className={cn(done.includes(i) && "text-muted-foreground line-through")}><span className="font-medium">{i + 1}.</span> {L(s)}</span>
                  </label>
                </li>
              ))}
            </ol>
          </section>
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tr("Réglages", "الإعدادات", "Settings")}</h2>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setP(start())}>{tr("Réinitialiser", "إعادة الضبط", "Reset")}</Button>
            </div>
            <ParamsForm template={lab.template} params={p} onChange={setP} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Sandbox({ tpl, ar, vr, onClose, onSave }: { tpl: TemplateDef; ar: boolean; vr: boolean; onClose: () => void; onSave?: (p: Params) => void }) {
  const { language } = useLanguage();
  const tr = (fr: string, a: string, en: string) => (language === "ar" ? a : language === "en" ? en : fr);
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const [p, setP] = useState<Params>(() => defaultParams(tpl.id));
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><span className="text-2xl">{tpl.icon}</span>{L(tpl.label)}</h1>
          <p className="text-sm text-muted-foreground">{L(tpl.desc)}</p>
        </div>
        <div className="flex gap-2">
          {onSave && <Button variant="outline" onClick={() => onSave(p)}><Save className="me-1.5 h-4 w-4" />{tr("En faire une scène", "تحويله إلى مشهد", "Make it a scene")}</Button>}
          <Button variant="outline" onClick={onClose}><X className="me-1.5 h-4 w-4" />{tr("Fermer", "إغلاق", "Close")}</Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Viewer3D template={tpl.id} params={p} ar={ar} vr={vr} height="min(62vh, 560px)" />
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{tr("Réglages", "الإعدادات", "Settings")}</h2>
          <ParamsForm template={tpl.id} params={p} onChange={setP} />
        </section>
      </div>
    </div>
  );
}
