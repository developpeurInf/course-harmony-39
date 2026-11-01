"use client";

/** Barre d'outils du tableau (verticale sur ordinateur, horizontale sur téléphone ou sur l'écran partagé) */
import { useState } from "react";
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Highlighter,
  ImagePlus,
  Minus,
  MousePointer2,
  MoveHorizontal,
  PenLine,
  Shapes,
  Sparkles,
  Square,
  StickyNote,
  Timer,
  Triangle,
  Type,
  Zap,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BoardTheme, ShapeKind } from "./model";
import { THEMES } from "./render";
import { HL_COLORS, HL_SIZES, INK_COLORS, NOTE_COLORS, PEN_SIZES, type Tool, type ToolState } from "./tools";
import type { Tr } from "../useTr";

export const TOOL_KEYS: Record<string, Tool> = { "1": "select", "2": "pan", "3": "pen", "4": "highlighter", "5": "eraser", "6": "laser", "7": "shape", "8": "text", "9": "note" };

const SHAPES: { id: ShapeKind; icon: any; fr: string; ar: string; en: string }[] = [
  { id: "rect", icon: Square, fr: "Rectangle", ar: "مستطيل", en: "Rectangle" },
  { id: "ellipse", icon: Circle, fr: "Ellipse", ar: "شكل بيضوي", en: "Ellipse" },
  { id: "poly", icon: Triangle, fr: "Triangle", ar: "مثلث", en: "Triangle" },
  { id: "diamond", icon: Diamond, fr: "Losange", ar: "معين", en: "Diamond" },
  { id: "line", icon: Minus, fr: "Ligne", ar: "خط", en: "Line" },
  { id: "arrow", icon: ArrowUpRight, fr: "Flèche", ar: "سهم", en: "Arrow" },
  { id: "dline", icon: MoveHorizontal, fr: "Double flèche", ar: "سهم مزدوج", en: "Double arrow" },
];

export function WbToolbar(props: {
  tools: ToolState;
  setTools: (p: Partial<ToolState>) => void;
  scope: "board" | "screen";
  vertical: boolean;
  theme: BoardTheme;
  tr: Tr;
  onImage?: () => void;
  className?: string;
}) {
  const { tools, setTools, scope, vertical, theme, tr } = props;
  const [styleOpen, setStyleOpen] = useState(false);
  const list: { id: Tool; icon: any; label: string; key: string }[] = [
    { id: "select", icon: MousePointer2, label: tr("Sélection", "تحديد", "Select"), key: "1" },
    ...(scope === "board" ? [{ id: "pan" as Tool, icon: Hand, label: tr("Déplacer (Espace)", "تحريك (مسافة)", "Pan (Space)"), key: "2" }] : []),
    { id: "pen", icon: PenLine, label: tr("Stylo", "قلم", "Pen"), key: "3" },
    { id: "highlighter", icon: Highlighter, label: tr("Surligneur", "قلم تمييز", "Highlighter"), key: "4" },
    { id: "eraser", icon: Eraser, label: tr("Gomme", "ممحاة", "Eraser"), key: "5" },
    { id: "laser", icon: Zap, label: tr("Pointeur laser", "مؤشر ليزر", "Laser pointer"), key: "6" },
    { id: "shape", icon: SHAPES.find(s => s.id === tools.shape)?.icon || Shapes, label: tr("Formes", "أشكال", "Shapes"), key: "7" },
    { id: "text", icon: Type, label: tr("Texte", "نص", "Text"), key: "8" },
    ...(scope === "board" ? [{ id: "note" as Tool, icon: StickyNote, label: tr("Note adhésive", "ملاحظة لاصقة", "Sticky note"), key: "9" }] : []),
  ];
  const t = tools.tool;
  const swatch = t === "highlighter" ? tools.hlColor : t === "note" ? tools.noteColor : tools.color;
  const fg = THEMES[theme].fg;
  const showStyle = !["select", "pan", "eraser", "laser"].includes(t);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-1 rounded-2xl bg-[#151b27]/95 p-1.5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur",
        vertical ? "flex-col" : "max-w-full flex-row overflow-x-auto",
        "meet-scroll",
        props.className,
      )}
      role="toolbar"
      aria-label={tr("Outils du tableau", "أدوات اللوحة", "Board tools")}
      aria-orientation={vertical ? "vertical" : "horizontal"}
    >
      {list.map(it => {
        const Icon = it.icon;
        const on = t === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => {
              if (on && showStyle) setStyleOpen(o => !o);
              setTools({ tool: it.id });
            }}
            aria-pressed={on}
            aria-label={`${it.label} (${it.key})`}
            title={`${it.label} (${it.key})`}
            className={cn(
              "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
              on ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {on && (it.id === "pen" || it.id === "highlighter") && (
              <span
                className="absolute bottom-1 h-1 w-4 rounded-full"
                style={{ background: it.id === "pen" ? (tools.color === "fg" ? fg : tools.color) : tools.hlColor }}
              />
            )}
            {it.id === "pen" && (tools.smart || tools.ephemeral) && (
              <span className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-300" />
            )}
          </button>
        );
      })}
      {scope === "board" && props.onImage && (
        <button
          type="button"
          onClick={props.onImage}
          aria-label={tr("Insérer une image (0)", "إدراج صورة (0)", "Insert image (0)")}
          title={tr("Insérer une image (0)", "إدراج صورة (0)", "Insert image (0)")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          <ImagePlus className="h-[18px] w-[18px]" />
        </button>
      )}
      <span className={cn("shrink-0 bg-white/10", vertical ? "my-0.5 h-px w-7" : "mx-0.5 h-7 w-px")} />
      <Popover open={styleOpen} onOpenChange={setStyleOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!showStyle}
            aria-label={tr("Couleur et épaisseur", "اللون والسمك", "Color and size")}
            title={tr("Couleur et épaisseur", "اللون والسمك", "Color and size")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10 disabled:opacity-35"
          >
            <span
              className="block rounded-full ring-2 ring-white/70"
              style={{
                background: swatch === "fg" ? fg : swatch,
                width: t === "note" ? 18 : 8 + Math.min(12, (t === "highlighter" ? tools.hl / 3 : tools.pen) * 0.8),
                height: t === "note" ? 18 : 8 + Math.min(12, (t === "highlighter" ? tools.hl / 3 : tools.pen) * 0.8),
                borderRadius: t === "note" ? 4 : 9999,
              }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={vertical ? "right" : "bottom"}
          align="center"
          sideOffset={10}
          className="w-[268px] rounded-2xl border-white/10 bg-[#151b27] p-3 text-white shadow-2xl"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <StylePanel tools={tools} setTools={setTools} tr={tr} fg={fg} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StylePanel({ tools, setTools, tr, fg }: { tools: ToolState; setTools: (p: Partial<ToolState>) => void; tr: Tr; fg: string }) {
  const t = tools.tool;
  if (t === "note")
    return (
      <Section title={tr("Couleur de la note", "لون الملاحظة", "Note color")}>
        <div className="grid grid-cols-6 gap-1.5">
          {NOTE_COLORS.map(c => (
            <Swatch key={c} color={c} on={tools.noteColor === c} square onClick={() => setTools({ noteColor: c })} />
          ))}
        </div>
      </Section>
    );
  const hl = t === "highlighter";
  const colors = hl ? HL_COLORS : INK_COLORS;
  const cur = hl ? tools.hlColor : tools.color;
  const sizes = hl ? HL_SIZES : PEN_SIZES;
  const curSize = hl ? tools.hl : tools.pen;
  return (
    <div className="space-y-3">
      {t === "shape" && (
        <Section title={tr("Forme", "الشكل", "Shape")}>
          <div className="grid grid-cols-7 gap-1">
            {SHAPES.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTools({ shape: s.id })}
                  aria-pressed={tools.shape === s.id}
                  title={tr(s.fr, s.ar, s.en)}
                  aria-label={tr(s.fr, s.ar, s.en)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition", tools.shape === s.id ? "bg-primary text-primary-foreground" : "hover:bg-white/10")}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Chip on={tools.fill} onClick={() => setTools({ fill: !tools.fill })}>
              {tr("Remplir", "تعبئة", "Fill")}
            </Chip>
            <Chip on={tools.dash} onClick={() => setTools({ dash: !tools.dash })}>
              {tr("Pointillés", "متقطع", "Dashed")}
            </Chip>
          </div>
        </Section>
      )}
      <Section title={tr("Couleur", "اللون", "Color")}>
        <div className="grid grid-cols-6 gap-1.5">
          {colors.map(c => (
            <Swatch key={c} color={c === "fg" ? fg : c} on={cur === c} onClick={() => setTools(hl ? { hlColor: c } : { color: c })} />
          ))}
          <label
            className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-white/20"
            title={tr("Autre couleur", "لون آخر", "Custom color")}
            style={{ background: "conic-gradient(#f43f5e,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#f43f5e)" }}
          >
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={cur.startsWith("#") ? cur : "#111827"}
              onChange={e => setTools(hl ? { hlColor: e.target.value } : { color: e.target.value })}
              aria-label={tr("Autre couleur", "لون آخر", "Custom color")}
            />
          </label>
        </div>
      </Section>
      {t !== "text" && (
        <Section title={tr("Épaisseur", "السمك", "Thickness")}>
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-1">
            {sizes.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setTools(hl ? { hl: s } : { pen: s })}
                aria-pressed={curSize === s}
                aria-label={String(s)}
                className={cn("flex h-9 flex-1 items-center justify-center rounded-lg transition", curSize === s ? "bg-white/15" : "hover:bg-white/10")}
              >
                <span className="rounded-full bg-white" style={{ width: Math.min(22, hl ? s / 1.5 : s + 2), height: Math.min(22, hl ? s / 1.5 : s + 2), opacity: hl ? 0.6 : 1 }} />
              </button>
            ))}
          </div>
        </Section>
      )}
      {t === "pen" && (
        <div className="space-y-1.5">
          <Toggle
            on={tools.smart}
            onClick={() => setTools({ smart: !tools.smart })}
            icon={<Sparkles className="h-4 w-4 text-amber-300" />}
            title={tr("Formes intelligentes", "أشكال ذكية", "Smart shapes")}
            text={tr("Un cercle ou un carré dessiné à main levée devient net.", "الدائرة أو المربع المرسوم باليد يصبح دقيقا.", "Hand-drawn circles and boxes snap to clean shapes.")}
          />
          <Toggle
            on={tools.ephemeral}
            onClick={() => setTools({ ephemeral: !tools.ephemeral })}
            icon={<Timer className="h-4 w-4 text-sky-300" />}
            title={tr("Encre éphémère", "حبر مؤقت", "Vanishing ink")}
            text={tr("Le trait s'efface tout seul après 4 secondes.", "يختفي الخط تلقائيا بعد 4 ثوان.", "Strokes fade away after 4 seconds.")}
          />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">{title}</p>
      {children}
    </div>
  );
}

function Swatch({ color, on, onClick, square }: { color: string; on: boolean; onClick: () => void; square?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={color}
      className={cn(
        "flex h-8 w-8 items-center justify-center transition hover:scale-110",
        square ? "rounded-md" : "rounded-full",
        on ? "ring-2 ring-white ring-offset-2 ring-offset-[#151b27]" : "ring-1 ring-white/30",
      )}
      style={{ background: color }}
    />
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", on ? "bg-primary text-primary-foreground ring-primary" : "ring-white/15 hover:bg-white/10")}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick, icon, title, text }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("flex w-full items-start gap-2.5 rounded-xl p-2 text-start transition", on ? "bg-white/10 ring-1 ring-white/15" : "hover:bg-white/5")}>
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[11px] leading-snug text-white/55">{text}</span>
      </span>
      <span className={cn("mt-1 h-4 w-7 shrink-0 rounded-full p-0.5 transition", on ? "bg-primary" : "bg-white/15")}>
        <span className={cn("block h-3 w-3 rounded-full bg-white transition", on && "translate-x-3 rtl:-translate-x-3")} />
      </span>
    </button>
  );
}
