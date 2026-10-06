import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, ShuffleIcon, Lock, Award, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizSettings as QuizSettingsType, DEFAULT_QUIZ_SETTINGS } from "@/contexts/CourseContext";

export type { QuizSettings } from "@/contexts/CourseContext";

interface QuizSettingsProps {
  initialSettings?: Partial<QuizSettingsType>;
  onSettingsChange: (settings: QuizSettingsType) => void;
}

const QuizSettings = ({ initialSettings, onSettingsChange }: QuizSettingsProps) => {
  const { language } = useLanguage();
  const [settings, setSettings] = useState<QuizSettingsType>({
    ...DEFAULT_QUIZ_SETTINGS,
    ...initialSettings
  });

  useEffect(() => {
    if (initialSettings) {
      setSettings(prev => ({
        ...prev,
        ...initialSettings
      }));
    }
  }, [JSON.stringify(initialSettings)]);

  const updateSetting = (key: keyof QuizSettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <Card className="w-full border-muted/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Settings className="h-5 w-5 text-primary" />
          {language === "ar" ? "إعدادات الاختبار" : language === "fr" ? "Configuration du Quiz" : "Quiz Configuration"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question Flow */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShuffleIcon className="h-4 w-4 text-primary" />
            {language === "ar" ? "تسلسل الأسئلة" : language === "fr" ? "Déroulement des questions" : "Question Flow"}
          </h3>
          
          <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-muted/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sequential" className="text-sm font-medium">
                  {language === "ar" ? "أسئلة متسلسلة إجبارياً" : language === "fr" ? "Questions séquentielles" : "Sequential Questions"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "يجب على التلاميذ الإجابة عن الأسئلة بالترتيب" : language === "fr" ? "Les élèves doivent répondre aux questions dans l'ordre" : "Students must answer questions in order"}
                </p>
              </div>
              <Switch
                id="sequential"
                checked={settings.sequentialQuestions}
                onCheckedChange={(checked) => updateSetting('sequentialQuestions', checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="shuffle-questions" className="text-sm font-medium">
                  {language === "ar" ? "ترتيب عشوائي للأسئلة" : language === "fr" ? "Mélanger les questions" : "Shuffle Questions"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "تغيير ترتيب الأسئلة عشوائياً لكل تلميذ" : language === "fr" ? "Ordre aléatoire des questions pour chaque élève" : "Randomize question order for each student"}
                </p>
              </div>
              <Switch
                id="shuffle-questions"
                checked={settings.shuffleQuestions}
                onCheckedChange={(checked) => updateSetting('shuffleQuestions', checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="shuffle-options" className="text-sm font-medium">
                  {language === "ar" ? "ترتيب عشوائي للخيارات" : language === "fr" ? "Mélanger les options" : "Shuffle Answer Options"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "تغيير ترتيب خيارات الإجابة عشوائياً" : language === "fr" ? "Ordre aléatoire des options au sein des questions" : "Randomize option order within questions"}
                </p>
              </div>
              <Switch
                id="shuffle-options"
                checked={settings.shuffleOptions}
                onCheckedChange={(checked) => updateSetting('shuffleOptions', checked)}
              />
            </div>
          </div>
        </div>

        {/* Attempt Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            {language === "ar" ? "إعدادات المحاولات" : language === "fr" ? "Paramètres des tentatives" : "Attempt Settings"}
          </h3>
          
          <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-muted/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="multiple-attempts" className="text-sm font-medium">
                  {language === "ar" ? "السماح بعدة محاولات" : language === "fr" ? "Autoriser plusieurs tentatives" : "Allow Multiple Attempts"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "يمكن للتلاميذ إعادة اجتياز الاختبار" : language === "fr" ? "Les élèves peuvent repasser le quiz" : "Students can retake the quiz"}
                </p>
              </div>
              <Switch
                id="multiple-attempts"
                checked={settings.allowMultipleAttempts}
                onCheckedChange={(checked) => updateSetting('allowMultipleAttempts', checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="corrections" className="text-sm font-medium">
                  {language === "ar" ? "السماح بالتعديل قبل الإرسال" : language === "fr" ? "Autoriser les corrections" : "Allow Corrections"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "يمكن للتلاميذ تعديل الإجابات قبل التأكيد النهائي" : language === "fr" ? "Les élèves peuvent modifier leurs réponses avant validation" : "Students can change answers before submitting"}
                </p>
              </div>
              <Switch
                id="corrections"
                checked={settings.allowCorrections}
                onCheckedChange={(checked) => updateSetting('allowCorrections', checked)}
              />
            </div>
          </div>
        </div>

        {/* Results & Review */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            {language === "ar" ? "النتائج والمراجعة" : language === "fr" ? "Résultats et révision" : "Results & Review"}
          </h3>
          
          <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-muted/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="immediate-results" className="text-sm font-medium">
                  {language === "ar" ? "إظهار النتيجة فوراً" : language === "fr" ? "Afficher les résultats immédiatement" : "Show Results Immediately"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "عرض النقطة للتلميذ فور إنهاء الاختبار" : language === "fr" ? "Afficher la note de l'élève dès la fin du test" : "Display score right after completion"}
                </p>
              </div>
              <Switch
                id="immediate-results"
                checked={settings.showResultsImmediately}
                onCheckedChange={(checked) => updateSetting('showResultsImmediately', checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="allow-review" className="text-sm font-medium">
                  {language === "ar" ? "السماح بمراجعة الإجابات الصحيحة" : language === "fr" ? "Autoriser la relecture du corrigé" : "Allow Answer Review"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "يمكن للتلميذ الاطلاع على التصحيح النموذجي" : language === "fr" ? "Les élèves peuvent consulter les bonnes réponses" : "Students can see correct answers and explanations"}
                </p>
              </div>
              <Switch
                id="allow-review"
                checked={settings.allowReview && settings.showResultsImmediately}
                disabled={!settings.showResultsImmediately}
                onCheckedChange={(checked) => updateSetting('allowReview', checked)}
              />
            </div>
            {!settings.showResultsImmediately && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-2 py-1.5">
                {language === "ar"
                  ? "مراجعة التصحيح غير متاحة عندما تكون النتيجة مخفية (لأنها تكشف النقطة)."
                  : language === "fr"
                  ? "La relecture du corrigé est désactivée tant que la note est masquée (elle révélerait le résultat)."
                  : "Answer review is disabled while the score is hidden (it would reveal the result)."}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuizSettings;
