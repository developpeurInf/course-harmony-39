"use client";

import { memo, useEffect, useRef, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { phPlaceholder, resolveColor, shapePath, slideBackground, themeOf, type Deck, type Slide, type SlideEl, type Theme } from "./model";
import type { Tr } from "../shared/useOfficeEnv";

export const PT = 96 / 72;

function Deco({ theme, w, h }: { theme: Theme; w: number; h: number }) {
  const a = theme.accents;
  switch (theme.deco) {
    case "bar": return <div className="absolute inset-y-0 start-0" style={{ width: 14, background: a[0] }} />;
    case "corner": return <svg className="absolute inset-0" width={w} height={h}><polygon points={`${w},0 ${w},${h * 0.35} ${w - h * 0.35},0`} fill={a[0]} opacity={0.85} /><polygon points={`0,${h} ${h * 0.22},${h} 0,${h - h * 0.22}`} fill={a[1]} opacity={0.8} /></svg>;
    case "band": return <div className="absolute inset-x-0 bottom-0" style={{ height: 18, background: `linear-gradient(90deg, ${a[0]}, ${a[1]})` }} />;
    case "circles": return <svg className="absolute inset-0" width={w} height={h}><circle cx={w * 0.92} cy={h * 0.1} r={h * 0.22} fill="#fff" opacity={0.12} /><circle cx={w * 0.05} cy={h * 0.95} r={h * 0.3} fill="#fff" opacity={0.1} /><circle cx={w * 0.8} cy={h * 0.9} r={h * 0.08} fill="#fff" opacity={0.15} /></svg>;
    case "wave": return <svg className="absolute inset-x-0 bottom-0" width={w} height={h * 0.25} viewBox={`0 0 ${w} ${h * 0.25}`} preserveAspectRatio="none"><path d={`M0,${h * 0.12} C${w * 0.25},${h * 0.02} ${w * 0.5},${h * 0.22} ${w},${h * 0.08} L${w},${h * 0.25} L0,${h * 0.25}Z`} fill="#fff" opacity={0.12} /></svg>;
    case "chalk": return <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 14px #6D4C41, inset 0 0 0 16px #4E342E, inset 0 0 80px rgba(0,0,0,.35)" }} />;
    case "grid": return <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(57,73,171,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(57,73,171,.07) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />;
    default: return null;
  }
}

export interface ElHandlers {
  onPointerDown?: (e: RPointerEvent, el: SlideEl) => void;
  onDoubleClick?: (el: SlideEl) => void;
  editingId?: string | null;
  onEditInput?: (el: SlideEl, html: string) => void;
  onEditEnd?: () => void;
}

export const SlideView = memo(function SlideView({
  slide, deck, scale, mode, L, handlers, animStep, footer, slideNo,
}: {
  slide: Slide;
  deck: Deck;
  scale: number;
  mode: "thumb" | "edit" | "show";
  L: Tr;
  handlers?: ElHandlers;
  animStep?: number;
  footer?: boolean;
  slideNo?: number;
}) {
  const theme = themeOf(deck.theme);
  const style: CSSProperties = { width: deck.w, height: deck.h, background: slideBackground(slide, theme), transform: `scale(${scale})`, transformOrigin: "0 0", color: theme.text, fontFamily: theme.bodyFont };
  return (
    <div style={{ width: deck.w * scale, height: deck.h * scale }} className="relative overflow-hidden">
      <div className="ppt-slide absolute start-0 top-0 overflow-hidden" style={style} dir="ltr">
        {!slide.bg?.image && <Deco theme={theme} w={deck.w} h={deck.h} />}
        {slide.els.map((el) => (
          <ElView key={el.id} el={el} theme={theme} mode={mode} L={L} handlers={handlers} hiddenByAnim={mode === "show" && !!el.anim && el.anim.type !== "none" && (animStep ?? 0) < el.anim.order} animate={mode === "show" && !!el.anim && el.anim.type !== "none" && (animStep ?? 0) >= el.anim.order} />
        ))}
        {footer && deck.footer && (deck.footer.text || deck.footer.number || deck.footer.date) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-between px-8 text-[12px] opacity-70" style={{ color: theme.text }}>
            <span>{deck.footer.date ? new Date().toLocaleDateString() : ""}</span>
            <span>{deck.footer.text}</span>
            <span>{deck.footer.number ? slideNo : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
});

function ElView({ el, theme, mode, L, handlers, hiddenByAnim, animate }: { el: SlideEl; theme: Theme; mode: "thumb" | "edit" | "show"; L: Tr; handlers?: ElHandlers; hiddenByAnim: boolean; animate: boolean }) {
  const editing = handlers?.editingId === el.id;
  const isTitle = el.ph === "title";
  const color = resolveColor(el.color, theme, isTitle ? theme.title : theme.text);
  const fill = resolveColor(el.fill, theme);
  const stroke = resolveColor(el.stroke, theme);
  const wrap: CSSProperties = {
    position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h,
    transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
    opacity: hiddenByAnim ? 0 : el.opacity ?? 1,
    filter: el.shadow ? "drop-shadow(0 6px 10px rgba(0,0,0,.35))" : undefined,
    animationDuration: animate ? `${el.anim?.dur ?? 0.6}s` : undefined,
  };
  const textStyle: CSSProperties = {
    fontFamily: el.font || (isTitle ? theme.headFont : theme.bodyFont),
    fontSize: (el.size || 18) * PT,
    color,
    fontWeight: el.bold ? 700 : undefined,
    fontStyle: el.italic ? "italic" : undefined,
    textDecoration: [el.underline ? "underline" : "", el.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
    textAlign: el.align || (el.dir === "rtl" ? "right" : "left"),
    lineHeight: el.lineHeight || 1.2,
    direction: el.dir,
    display: "flex", flexDirection: "column",
    justifyContent: el.valign === "middle" ? "center" : el.valign === "bottom" ? "flex-end" : "flex-start",
    padding: el.kind === "text" ? "6px 10px" : "8px 14px",
    width: "100%", height: "100%", overflow: mode === "edit" ? "visible" : "hidden", position: "relative",
  };
  const pd = mode === "edit" ? { onPointerDown: (e: RPointerEvent) => handlers?.onPointerDown?.(e, el), onDoubleClick: () => handlers?.onDoubleClick?.(el) } : {};
  const empty = !el.html || el.html === "<p></p>" || el.html.replace(/<[^>]+>/g, "").trim() === "";
  const animClass = animate && el.anim ? `ppt-anim-${el.anim.type}` : "";

  let inner: React.ReactNode = null;
  if (el.kind === "image") {
    inner = el.src ? <img src={el.src} alt="" draggable={false} className="h-full w-full select-none" style={{ objectFit: "cover", borderRadius: el.crop === "circle" ? "50%" : el.crop === "rounded" ? 18 : undefined, border: stroke ? `${el.strokeW || 2}px solid ${stroke}` : undefined }} /> : null;
  } else if (el.kind === "video") {
    const yt = (el.url || "").match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
    inner = mode === "show" && yt ? (
      <iframe src={`https://www.youtube.com/embed/${yt[1]}`} className="h-full w-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen title="video" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-black/80 text-white"><span style={{ fontSize: 48 }}>▶</span></div>
    );
  } else if (el.kind === "line") {
    const sw = el.strokeW || 3;
    inner = (
      <svg width={el.w} height={Math.max(el.h, sw)} className="overflow-visible">
        <defs><marker id={`ah-${el.id}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill={stroke || theme.text} /></marker></defs>
        <line x1={0} y1={el.h / 2} x2={el.w} y2={el.h / 2} stroke={stroke || theme.text} strokeWidth={sw} strokeDasharray={el.dash === "dash" ? `${sw * 4} ${sw * 2}` : el.dash === "dot" ? `${sw} ${sw * 1.5}` : undefined} markerEnd={el.arrow ? `url(#ah-${el.id})` : undefined} />
      </svg>
    );
  } else if (el.kind === "table" && el.table) {
    const t = el.table;
    const head = resolveColor(t.style === "theme" ? "accent" : t.style, theme) || theme.accents[0];
    inner = (
      <table className="h-full w-full border-collapse" style={{ fontSize: (el.size || 14) * PT, color, fontFamily: el.font || theme.bodyFont, tableLayout: "fixed", direction: el.dir }}>
        <tbody>
          {t.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <TableCell
                  key={c}
                  text={cell}
                  editing={editing}
                  style={{ border: `1px solid ${stroke || "rgba(127,127,127,.5)"}`, background: t.header && r === 0 ? head : r % 2 === 1 ? "rgba(127,127,127,.12)" : "transparent", color: t.header && r === 0 ? "#fff" : undefined, fontWeight: t.header && r === 0 ? 700 : undefined }}
                  onText={(v) => { const rows = t.rows.map((x) => x.slice()); rows[r][c] = v; handlers?.onEditInput?.({ ...el, table: { ...t, rows } }, ""); }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    // texte et formes
    const shapeSvg = el.kind === "shape" ? (
      <svg className="absolute inset-0 overflow-visible" width={el.w} height={el.h}>
        <path d={shapePath(el.shape, el.w, el.h, el.radius)} fill={fill || "none"} stroke={stroke || "none"} strokeWidth={el.strokeW || 2} strokeDasharray={el.dash === "dash" ? "8 5" : el.dash === "dot" ? "2 4" : undefined} />
      </svg>
    ) : null;
    const boxBg: CSSProperties = el.kind === "text" ? { background: fill || undefined, border: stroke ? `${el.strokeW || 1}px ${el.dash === "dash" ? "dashed" : el.dash === "dot" ? "dotted" : "solid"} ${stroke}` : undefined, borderRadius: el.radius } : {};
    inner = (
      <>
        {shapeSvg}
        <div style={{ ...textStyle, ...boxBg }}>
          {editing ? (
            <RichEdit el={el} onInput={(h) => handlers?.onEditInput?.(el, h)} onEnd={() => handlers?.onEditEnd?.()} />
          ) : empty && mode === "edit" && el.ph ? (
            <div className="ppt-text pointer-events-none opacity-50">{phPlaceholder(el, L)}</div>
          ) : (
            <div className="ppt-text" dangerouslySetInnerHTML={{ __html: el.html || "" }} />
          )}
        </div>
      </>
    );
  }

  return (
    <div style={wrap} className={cn(mode === "edit" && !editing && "cursor-move", mode === "edit" && el.ph && empty && "outline-dashed outline-1 outline-slate-400/70", animClass)} {...pd} data-el={el.id}>
      {inner}
    </div>
  );
}

function RichEdit({ el, onInput, onEnd }: { el: SlideEl; onInput: (h: string) => void; onEnd: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.innerHTML = el.html || "";
    d.focus();
    // curseur à la fin
    const r = document.createRange();
    r.selectNodeContents(d);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.id]);
  return (
    <div
      ref={ref}
      className="ppt-text ppt-editing cursor-text outline-none"
      contentEditable
      suppressContentEditableWarning
      onPointerDown={(e) => e.stopPropagation()}
      onInput={() => onInput(ref.current?.innerHTML || "")}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onEnd(); } e.stopPropagation(); }}
      spellCheck
    />
  );
}

/** Cellule de tableau : non contrôlée pendant l'édition pour garder le curseur en place */
function TableCell({ text, editing, style, onText }: { text: string; editing: boolean; style: CSSProperties; onText: (v: string) => void }) {
  const ref = useRef<HTMLTableCellElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerText !== text) ref.current.innerText = text; }, [text, editing]);
  return (
    <td
      ref={ref}
      className="px-2 py-1 align-middle"
      style={style}
      contentEditable={editing}
      suppressContentEditableWarning
      onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
      onKeyDown={editing ? (e) => e.stopPropagation() : undefined}
      onInput={editing ? (e) => onText((e.target as HTMLElement).innerText) : undefined}
    />
  );
}
