import { useState } from "react";
import { ChevronDown, Eye, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS, pickText, readableOn, type AppSettings } from "@/lib/appSettings";
import { useT } from "../adminShared";

const TONE: Record<AppSettings["texts"]["announcementTone"], string> = {
  info: "border-sky-300 bg-sky-50 text-sky-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

/** Petit logo : image ou initiale sur la couleur principale */
function MiniLogo({ s, size }: { s: AppSettings; size: number }) {
  const fg = `hsl(${readableOn(s.theme.primary)})`;
  if (s.identity.logoUrl) {
    return <img src={s.identity.logoUrl} alt="" style={{ width: size, height: size, borderRadius: `${s.theme.radius * 0.75}rem` }} className="flex-shrink-0 object-contain" />;
  }
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center font-mono font-semibold"
      style={{ width: size, height: size, borderRadius: `${s.theme.radius * 0.75}rem`, backgroundColor: s.theme.primary, color: fg, fontSize: size * 0.5 }}
    >
      ∞
    </span>
  );
}

/**
 * Aperçu rendu avec les valeurs du BROUILLON (indépendant du thème appliqué) :
 * carte de connexion, en-tête du menu, boutons, badges et bandeau d'annonce.
 */
export default function LivePreview({ draft, live, onLiveChange }: { draft: AppSettings; live: boolean; onLiveChange: (v: boolean) => void }) {
  const { L, lang, rtl } = useT();
  const [open, setOpen] = useState(false);
  const s = draft;
  const r = `${s.theme.radius}rem`;
  const fg = `hsl(${readableOn(s.theme.primary)})`;
  const font = (FONT_OPTIONS[s.theme.font] || FONT_OPTIONS.system).css || undefined;
  const announcement = pickText(s.texts.announcement, lang);
  const tagline = pickText(s.identity.tagline, lang);

  const body = (
    <div className="space-y-3" style={{ fontFamily: font }} dir={rtl ? "rtl" : "ltr"}>
      {/* bandeau d'annonce */}
      {announcement ? (
        <div className={cn("flex items-start gap-2 border px-3 py-2 text-xs font-medium", TONE[s.texts.announcementTone])} style={{ borderRadius: r }}>
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span className="min-w-0 break-words">{announcement}</span>
        </div>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-2 text-center text-[11px] text-muted-foreground">
          {L("Aucune annonce (bandeau masqué)", "لا يوجد إعلان (الشريط مخفي)", "No announcement (banner hidden)")}
        </p>
      )}

      {/* en-tête du menu latéral */}
      <div className="flex items-center gap-2.5 border bg-white p-2.5 text-slate-900" style={{ borderRadius: r }}>
        <MiniLogo s={s} size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{s.identity.appName || "—"}</p>
          {tagline && <p className="truncate text-[11px] text-slate-500">{tagline}</p>}
        </div>
        <span className="ml-auto truncate px-2 py-1 text-[11px] font-semibold rtl:ml-0 rtl:mr-auto" style={{ backgroundColor: s.theme.accent, color: "#0f172a", borderRadius: r }}>
          {L("Tableau de bord", "لوحة القيادة", "Dashboard")}
        </span>
      </div>

      {/* carte de connexion */}
      <div className="border bg-white p-4 text-center text-slate-900 shadow-sm" style={{ borderRadius: r }}>
        <div className="mb-2 flex justify-center">
          <MiniLogo s={s} size={40} />
        </div>
        <p className="text-base font-semibold">{pickText(s.texts.loginTitle, lang) || "—"}</p>
        <p className="mt-0.5 text-xs text-slate-500">{pickText(s.texts.loginSubtitle, lang)}</p>
        <div className="mt-3 h-8 border border-slate-200 bg-slate-50" style={{ borderRadius: `calc(${r} - 2px)` }} />
        <button type="button" tabIndex={-1} className="mt-2 w-full py-2 text-sm font-semibold" style={{ backgroundColor: s.theme.primary, color: fg, borderRadius: `calc(${r} - 2px)` }}>
          {L("Se connecter", "تسجيل الدخول", "Log in")}
        </button>
        {pickText(s.texts.loginHelpStudent, lang) && <p className="mt-2 text-[11px] text-slate-500">{pickText(s.texts.loginHelpStudent, lang)}</p>}
      </div>

      {/* boutons et badges */}
      <div className="flex flex-wrap items-center gap-2 border bg-white p-3" style={{ borderRadius: r }}>
        <span className="px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: s.theme.primary, color: fg, borderRadius: `calc(${r} - 2px)` }}>
          {L("Principal", "رئيسي", "Primary")}
        </span>
        <span className="border px-3 py-1.5 text-xs font-semibold text-slate-900" style={{ backgroundColor: s.theme.accent, borderRadius: `calc(${r} - 2px)` }}>
          {L("Secondaire", "ثانوي", "Secondary")}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: s.theme.success }}>
          {L("Réussi", "ناجح", "Passed")} 14/20
        </span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: s.theme.danger }}>
          {L("Échec", "راسب", "Failed")}
        </span>
      </div>
    </div>
  );

  const toggle = (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor="cz-live" className="cursor-pointer text-sm font-semibold">{L("Aperçu en direct dans toute l'application", "معاينة مباشرة في كل التطبيق", "Live preview across the whole app")}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {L("Seulement sur cet appareil, jusqu'à l'enregistrement.", "على هذا الجهاز فقط، إلى غاية الحفظ.", "Only on this device, until you save.")}
        </p>
      </div>
      <Switch id="cz-live" checked={live} onCheckedChange={v => onLiveChange(!!v)} className="mt-0.5" />
    </div>
  );

  return (
    <aside aria-label={L("Aperçu", "معاينة", "Preview")} className="rounded-xl border bg-card shadow-sm">
      {/* téléphone / tablette : repliable */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="cz-preview-body"
        onClick={() => setOpen(o => !o)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold lg:hidden"
      >
        <span className="flex items-center gap-2"><Eye className="h-4 w-4" />{L("Aperçu", "معاينة", "Preview")}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      <div className="hidden items-center gap-2 border-b px-4 py-3 text-sm font-semibold lg:flex">
        <Eye className="h-4 w-4" />
        {L("Aperçu", "معاينة", "Preview")}
      </div>
      <div id="cz-preview-body" className={cn("space-y-3 p-3 sm:p-4 lg:block", open ? "block border-t lg:border-t-0" : "hidden")}>
        {toggle}
        <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800/60">{body}</div>
      </div>
    </aside>
  );
}
