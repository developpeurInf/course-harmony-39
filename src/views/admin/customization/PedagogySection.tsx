import { GraduationCap, ListChecks, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AppSettings, AttemptRule } from "@/lib/appSettings";
import { useT } from "../adminShared";
import { Card, Field, NativeSelect, NumberField, SwitchRow, type SectionProps } from "./shared";

type QuizBool = Exclude<keyof AppSettings["pedagogy"]["quizDefaults"], "maxFocusLosses" | "defaultDurationMinutes">;

export default function PedagogySection({ draft, update }: SectionProps) {
  const { L } = useT();
  const pg = draft.pedagogy;
  const qd = pg.quizDefaults;
  const setQuiz = (patch: Partial<AppSettings["pedagogy"]["quizDefaults"]>) => update("pedagogy", { quizDefaults: { ...qd, ...patch } });

  const policies: { value: AttemptRule; label: string }[] = [
    { value: "last", label: L("Dernière tentative", "آخر محاولة", "Last attempt") },
    { value: "best", label: L("Meilleure note", "أفضل نقطة", "Best score") },
    { value: "average", label: L("Moyenne des tentatives", "معدل المحاولات", "Average of attempts") },
  ];

  const switches: { k: QuizBool; label: string; desc: string }[] = [
    { k: "sequentialQuestions", label: L("Questions une par une", "الأسئلة واحدا تلو الآخر", "One question at a time"), desc: L("L'élève ne peut pas revenir en arrière.", "لا يمكن للتلميذ الرجوع إلى الوراء.", "Students cannot go back.") },
    { k: "allowMultipleAttempts", label: L("Plusieurs tentatives", "عدة محاولات", "Multiple attempts"), desc: L("L'élève peut repasser le quiz.", "يمكن للتلميذ إعادة الاختبار.", "Students can retake the quiz.") },
    { k: "allowCorrections", label: L("Afficher les corrections", "عرض التصحيحات", "Show corrections"), desc: L("Bonnes réponses visibles après l'envoi.", "الأجوبة الصحيحة تظهر بعد الإرسال.", "Correct answers shown after submitting.") },
    { k: "shuffleQuestions", label: L("Mélanger les questions", "خلط الأسئلة", "Shuffle questions"), desc: L("Ordre différent pour chaque élève.", "ترتيب مختلف لكل تلميذ.", "Different order for each student.") },
    { k: "shuffleOptions", label: L("Mélanger les réponses", "خلط الاختيارات", "Shuffle answers"), desc: L("Les choix des QCM changent d'ordre.", "يتغير ترتيب اختيارات الأسئلة المتعددة.", "Multiple-choice options change order.") },
    { k: "showResultsImmediately", label: L("Résultat immédiat", "النتيجة فورا", "Immediate result"), desc: L("La note s'affiche dès la fin du quiz.", "تظهر النقطة مباشرة بعد نهاية الاختبار.", "The score shows as soon as the quiz ends.") },
    { k: "allowReview", label: L("Revoir sa copie", "مراجعة الورقة", "Review own answers"), desc: L("L'élève peut consulter ses réponses ensuite.", "يمكن للتلميذ الاطلاع على أجوبته لاحقا.", "Students can look at their answers later.") },
    { k: "antiCheat", label: L("Anti-triche", "مكافحة الغش", "Anti-cheat"), desc: L("Plein écran et détection des changements d'onglet.", "ملء الشاشة ورصد تغيير النوافذ.", "Full screen and tab-switch detection.") },
  ];

  return (
    <div className="space-y-4">
      <Card
        icon={<GraduationCap className="h-4 w-4" />}
        title={L("Notation", "التنقيط", "Grading")}
        description={L("Utilisé dans les résultats, rapports et tableaux de bord.", "يُستعمل في النتائج والتقارير ولوحات القيادة.", "Used in results, reports and dashboards.")}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="cz-scale" label={L("Barème", "سلم التنقيط", "Grade scale")} hint={L("Notes affichées sur 20", "النقط معروضة على 20", "Scores shown out of 20")}>
            <Input id="cz-scale" readOnly dir="ltr" value={`/ ${pg.gradeScale || 20}`} className="w-28 bg-muted font-semibold" />
          </Field>
          <Field id="cz-pass" label={L("Seuil de réussite", "عتبة النجاح", "Pass mark")} hint={L("Entre 0 et 20, par pas de 0,5", "بين 0 و20، بخطوة 0.5", "Between 0 and 20, step 0.5")}>
            <NumberField id="cz-pass" value={pg.passThreshold} min={0} max={20} step={0.5} suffix="/ 20" onChange={v => update("pedagogy", { passThreshold: v })} />
          </Field>
          <Field id="cz-policy" label={L("Note retenue", "النقطة المعتمدة", "Score kept")} hint={L("Quand l'élève a plusieurs tentatives", "عندما تكون للتلميذ عدة محاولات", "When a student has several attempts")}>
            <NativeSelect id="cz-policy" value={pg.attemptPolicy} onChange={v => update("pedagogy", { attemptPolicy: v as AttemptRule })} options={policies} />
          </Field>
        </div>
      </Card>

      <Card
        icon={<ListChecks className="h-4 w-4" />}
        title={L("Réglages par défaut des quiz", "الإعدادات الافتراضية للاختبارات", "Quiz defaults")}
        description={L("Pré-remplis à la création d'un nouveau quiz ou examen.", "تُملأ مسبقا عند إنشاء اختبار أو امتحان جديد.", "Pre-filled when creating a new quiz or exam.")}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {switches.map(s => (
            <SwitchRow key={s.k} id={`cz-q-${s.k}`} label={s.label} description={s.desc} checked={!!qd[s.k]} onChange={v => setQuiz({ [s.k]: v } as Partial<AppSettings["pedagogy"]["quizDefaults"]>)} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cz-focus" label={L("Sorties d'écran tolérées", "عدد مرات مغادرة الشاشة المسموح بها", "Allowed focus losses")} hint={qd.antiCheat ? L("Entre 1 et 10", "بين 1 و10", "Between 1 and 10") : L("Activez l'anti-triche pour régler ce nombre", "فعّل مكافحة الغش لضبط هذا العدد", "Turn on anti-cheat to set this")}>
            <NumberField id="cz-focus" value={qd.maxFocusLosses} min={1} max={10} disabled={!qd.antiCheat} onChange={v => setQuiz({ maxFocusLosses: v })} />
          </Field>
          <Field id="cz-duration" label={L("Durée par défaut", "المدة الافتراضية", "Default duration")} hint={L("Entre 1 et 300 minutes", "بين 1 و300 دقيقة", "Between 1 and 300 minutes")}>
            <NumberField id="cz-duration" value={qd.defaultDurationMinutes} min={1} max={300} suffix={L("min", "دقيقة", "min")} onChange={v => setQuiz({ defaultDurationMinutes: v })} />
          </Field>
        </div>
      </Card>

      <Card icon={<Shield className="h-4 w-4" />} title={L("Liberté des professeurs", "حرية الأساتذة", "Teacher freedom")}>
        <SwitchRow
          id="cz-override"
          label={L("Les professeurs peuvent modifier ces valeurs", "يمكن للأساتذة تعديل هذه القيم", "Teachers can change these values")}
          description={
            pg.teachersCanOverride
              ? L("Activé : chaque professeur part de ces valeurs et peut les adapter dans ses Paramètres et pour chaque quiz.", "مفعل: ينطلق كل أستاذ من هذه القيم ويمكنه تكييفها في إعداداته ولكل اختبار.", "On: each teacher starts from these values and can adapt them in their Settings and for each quiz.")
              : L("Désactivé : ces valeurs s'imposent à tous les professeurs (ils ne peuvent plus les changer).", "معطل: تُفرض هذه القيم على جميع الأساتذة (لا يمكنهم تغييرها).", "Off: these values apply to every teacher (they can no longer change them).")
          }
          checked={pg.teachersCanOverride}
          onChange={v => update("pedagogy", { teachersCanOverride: v })}
        />
      </Card>
    </div>
  );
}
