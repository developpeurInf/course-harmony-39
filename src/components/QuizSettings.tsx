import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Clock, ShuffleIcon, Lock } from "lucide-react";

interface QuizSettingsProps {
  onSettingsChange: (settings: QuizSettings) => void;
}

export interface QuizSettings {
  sequentialQuestions: boolean;
  allowMultipleAttempts: boolean;
  allowCorrections: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  timeLimit: number | null;
  showResultsImmediately: boolean;
  allowReview: boolean;
}

const QuizSettings = ({ onSettingsChange }: QuizSettingsProps) => {
  const [settings, setSettings] = useState<QuizSettings>({
    sequentialQuestions: false,
    allowMultipleAttempts: false,
    allowCorrections: true,
    shuffleQuestions: false,
    shuffleOptions: false,
    timeLimit: null,
    showResultsImmediately: true,
    allowReview: true,
  });

  const updateSetting = (key: keyof QuizSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          Quiz Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question Flow */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShuffleIcon className="h-4 w-4" />
            Question Flow
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sequential">Sequential Questions</Label>
                <p className="text-xs text-muted-foreground">
                  Students must answer questions in order
                </p>
              </div>
              <Switch
                id="sequential"
                checked={settings.sequentialQuestions}
                onCheckedChange={(checked) => updateSetting('sequentialQuestions', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="shuffle-questions">Shuffle Questions</Label>
                <p className="text-xs text-muted-foreground">
                  Randomize question order for each student
                </p>
              </div>
              <Switch
                id="shuffle-questions"
                checked={settings.shuffleQuestions}
                onCheckedChange={(checked) => updateSetting('shuffleQuestions', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="shuffle-options">Shuffle Answer Options</Label>
                <p className="text-xs text-muted-foreground">
                  Randomize option order within questions
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
            <Lock className="h-4 w-4" />
            Attempt Settings
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="multiple-attempts">Allow Multiple Attempts</Label>
                <p className="text-xs text-muted-foreground">
                  Students can retake the quiz
                </p>
              </div>
              <Switch
                id="multiple-attempts"
                checked={settings.allowMultipleAttempts}
                onCheckedChange={(checked) => updateSetting('allowMultipleAttempts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="corrections">Allow Corrections</Label>
                <p className="text-xs text-muted-foreground">
                  Students can change answers before submitting
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
          <h3 className="text-sm font-semibold text-foreground">Results & Review</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="immediate-results">Show Results Immediately</Label>
                <p className="text-xs text-muted-foreground">
                  Display score right after submission
                </p>
              </div>
              <Switch
                id="immediate-results"
                checked={settings.showResultsImmediately}
                onCheckedChange={(checked) => updateSetting('showResultsImmediately', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow-review">Allow Answer Review</Label>
                <p className="text-xs text-muted-foreground">
                  Students can review their answers after completion
                </p>
              </div>
              <Switch
                id="allow-review"
                checked={settings.allowReview}
                onCheckedChange={(checked) => updateSetting('allowReview', checked)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuizSettings;