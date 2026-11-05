"use client";

/**
 * Diaporama plein écran : transitions, animations au clic, mode présentateur (notes, minuteur,
 * diapositive suivante), stylo, surligneur, pointeur laser, écran noir / blanc, aller à la diapo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Highlighter, LayoutGrid, MousePointer2, Pen, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deck } from "./model";
import { SlideView } from "./SlideView";
import type { Tr } from "../shared/useOfficeEnv";

type Tool = "none" | "pen" | "highlighter" | "laser";

export function Slideshow({ deck, start, presenter, L, onExit }: { deck: Deck; start: number; presenter: boolean; L: Tr; onExit: (index: number) => void }) {
  const visible = useMemo(() => deck.slides.map((s, i) => ({ s, i })).filter((x) => !x.s.hidden), [deck.slides]);
  const startPos = Math.max(0, visible.findIndex((x) => x.i >= start));
  const [pos, setPos] = useState(startPos);
  const [step, setStep] = useState(0);
  const [blank, setBlank] = useState<null | "black" | "white">(null);
  const [tool, setTool] = useState<Tool>("none");
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [elapsed, setElapsed] = useState(0);
  const [grid, setGrid] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [idle, setIdle] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<Record<number, ImageData>>({});
  const drawing = useRef(false);
  const typed = useRef("");

  const cur = visible[pos];
  const steps = useMemo(() => (cur ? Array.from(new Set(cur.s.els.filter((e) => e.anim && e.anim.type !== "none").map((e) => e.anim!.order))).sort((a, b) => a - b) : []), [cur]);
  const animStep = step === 0 ? 0 : steps[step - 1] ?? 999;

  // Plein écran
  useEffect(() => {
    const el = rootRef.current;
    if (el && !presenter && document.fullscreenEnabled) el.requestFullscreen?.().catch(() => {});
    const onFs = () => { if (!document.fullscreenElement && !presenter) { /* sortie via Échap natif */ } };
    document.addEventListener("fullscreenchange", onFs);
    return () => { document.removeEventListener("fullscreenchange", onFs); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  }, [presenter]);

  useEffect(() => {
    const onR = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  useEffect(() => { const t = setInterval(() => setElapsed((x) => x + 1), 1000); return () => clearInterval(t); }, []);

  // Masquer le curseur et la barre après 2,5 s d'inactivité
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2500); };
    wake();
    window.addEventListener("pointermove", wake);
    return () => { clearTimeout(t); window.removeEventListener("pointermove", wake); };
  }, []);

  const saveInk = useCallback(() => {
    const c = canvasRef.current;
    if (c && c.width) inkRef.current[pos] = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  }, [pos]);

  const go = useCallback((p: number, toEnd = false) => {
    if (p < 0) return;
    if (p >= visible.length) { onExit(visible[visible.length - 1]?.i ?? 0); return; }
    saveInk();
    setPos(p);
    const target = visible[p];
    const n = new Set(target.s.els.filter((e) => e.anim && e.anim.type !== "none").map((e) => e.anim!.order)).size;
    setStep(toEnd ? n : 0);
  }, [visible, onExit, saveInk]);

  const next = useCallback(() => {
    if (blank) { setBlank(null); return; }
    if (step < steps.length) setStep(step + 1);
    else go(pos + 1);
  }, [blank, step, steps.length, go, pos]);
  const prev = useCallback(() => {
    if (blank) { setBlank(null); return; }
    if (step > 0) setStep(step - 1);
    else go(pos - 1, true);
  }, [blank, step, go, pos]);

  // Restaurer l'encre de la diapositive
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const img = inkRef.current[pos];
    if (img && img.width === c.width) ctx.putImageData(img, 0, 0);
  }, [pos, size]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (/^\d$/.test(k)) { typed.current += k; return; }
      if (k === "Enter" && typed.current) { go(Math.min(visible.length - 1, Number(typed.current) - 1)); typed.current = ""; return; }
      typed.current = "";
      if (k === "Escape") { e.preventDefault(); if (tool !== "none") setTool("none"); else onExit(cur?.i ?? 0); return; }
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"].includes(k)) { e.preventDefault(); next(); return; }
      if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"].includes(k) && !(k.toLowerCase() === "p" && e.ctrlKey)) {
        if (k === "p" || k === "P") { setTool((t) => (t === "pen" ? "none" : "pen")); return; }
        e.preventDefault(); prev(); return;
      }
      if (k === "Home") { go(0); return; }
      if (k === "End") { go(visible.length - 1, true); return; }
      if (k === "b" || k === "B" || k === ".") { setBlank((b) => (b === "black" ? null : "black")); return; }
      if (k === "w" || k === "W" || k === ",") { setBlank((b) => (b === "white" ? null : "white")); return; }
      if (k === "l" || k === "L") { setTool((t) => (t === "laser" ? "none" : "laser")); return; }
      if (k === "h" || k === "H") { setTool((t) => (t === "highlighter" ? "none" : "highlighter")); return; }
      if (k === "e" || k === "E") { const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); delete inkRef.current[pos]; return; }
      if (k === "g" || k === "G" || k === "-") { setGrid((g) => !g); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go, onExit, cur, tool, visible.length, pos]);

  // Zone d'affichage
  const area = presenter ? { w: size.w * 0.62, h: size.h - 120 } : size;
  const scale = Math.min(area.w / deck.w, area.h / deck.h);
  const sw = deck.w * scale, sh = deck.h * scale;

  const pt = (e: React.PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onDown = (e: React.PointerEvent) => {
    if (tool === "none") { if (e.button === 0) next(); return; }
    if (tool === "laser") return;
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pt(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = tool === "pen" ? "#E53935" : "rgba(255,235,59,.45)";
    ctx.lineWidth = tool === "pen" ? 3 : 22;
  };
  const onMove = (e: React.PointerEvent) => {
    if (tool === "laser") { const p = pt(e); setLaser(p); return; }
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pt(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const onUp = () => { drawing.current = false; };

  const nextSlide = visible[pos + 1];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const stage = cur && (
    <div className="relative" style={{ width: sw, height: sh }}>
      <div key={cur.s.id} className={cn(cur.s.transition.type !== "none" && `ppt-trans-${cur.s.transition.type}`)} style={{ animationDuration: `${cur.s.transition.dur}s` }}>
        <SlideView slide={cur.s} deck={deck} scale={scale} mode="show" animStep={animStep} L={L} footer slideNo={cur.i + 1} />
      </div>
      <canvas
        ref={canvasRef}
        width={Math.round(sw)}
        height={Math.round(sh)}
        className="absolute inset-0"
        style={{ cursor: tool === "pen" || tool === "highlighter" ? "crosshair" : tool === "laser" ? "none" : idle ? "none" : "default", pointerEvents: cur.s.els.some((e) => e.kind === "video") && tool === "none" ? "none" : "auto" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => { onUp(); setLaser(null); }}
        onContextMenu={(e) => { e.preventDefault(); prev(); }}
      />
      {tool === "laser" && laser && <div className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_14px_6px_rgba(255,0,0,.6)]" style={{ left: laser.x, top: laser.y }} />}
      {blank && <div className={cn("absolute inset-0", blank === "black" ? "bg-black" : "bg-white")} onClick={() => setBlank(null)} />}
    </div>
  );

  const tools = (
    <div className={cn("flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-white transition-opacity", idle && !presenter && "opacity-0")}>
      <button type="button" title={L("Précédent", "السابق", "Previous")} onClick={prev} className="rounded-full p-1.5 hover:bg-white/20"><ChevronLeft className="h-4 w-4" /></button>
      <button type="button" title={L("Suivant", "التالي", "Next")} onClick={next} className="rounded-full p-1.5 hover:bg-white/20"><ChevronRight className="h-4 w-4" /></button>
      <span className="mx-1 h-4 w-px bg-white/30" />
      <button type="button" title={L("Stylo (P)", "قلم (P)", "Pen (P)")} onClick={() => setTool((t) => (t === "pen" ? "none" : "pen"))} className={cn("rounded-full p-1.5 hover:bg-white/20", tool === "pen" && "bg-white/30")}><Pen className="h-4 w-4" /></button>
      <button type="button" title={L("Surligneur (H)", "قلم تمييز (H)", "Highlighter (H)")} onClick={() => setTool((t) => (t === "highlighter" ? "none" : "highlighter"))} className={cn("rounded-full p-1.5 hover:bg-white/20", tool === "highlighter" && "bg-white/30")}><Highlighter className="h-4 w-4" /></button>
      <button type="button" title={L("Pointeur laser (L)", "مؤشر ليزر (L)", "Laser pointer (L)")} onClick={() => setTool((t) => (t === "laser" ? "none" : "laser"))} className={cn("rounded-full p-1.5 hover:bg-white/20", tool === "laser" && "bg-white/30")}><MousePointer2 className="h-4 w-4" /></button>
      <button type="button" title={L("Effacer l'encre (E)", "مسح الحبر (E)", "Erase ink (E)")} onClick={() => { const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); delete inkRef.current[pos]; }} className="rounded-full p-1.5 hover:bg-white/20"><Eraser className="h-4 w-4" /></button>
      <button type="button" title={L("Toutes les diapositives (G)", "كل الشرائح (G)", "All slides (G)")} onClick={() => setGrid((g) => !g)} className="rounded-full p-1.5 hover:bg-white/20"><LayoutGrid className="h-4 w-4" /></button>
      <span className="mx-1 text-xs tabular-nums">{pos + 1} / {visible.length}</span>
      <button type="button" title={L("Quitter (Échap)", "خروج (Esc)", "End show (Esc)")} onClick={() => onExit(cur?.i ?? 0)} className="rounded-full p-1.5 hover:bg-white/20"><X className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div ref={rootRef} className="safe-inset fixed inset-0 z-[200] select-none bg-black" dir="ltr">
      {presenter ? (
        <div className="flex h-full flex-col bg-[#1b1b1b] p-4 text-white">
          <div className="mb-3 flex items-center gap-3 text-sm">
            <Timer className="h-4 w-4" /><span className="font-mono text-lg tabular-nums">{fmt(elapsed)}</span>
            <button type="button" className="rounded border border-white/30 px-2 py-0.5 text-xs hover:bg-white/10" onClick={() => setElapsed(0)}>{L("Réinitialiser", "إعادة", "Reset")}</button>
            <span className="text-white/60">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="ms-auto">{tools}</span>
          </div>
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex items-center justify-center" style={{ width: size.w * 0.62 }}>{stage}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="text-xs uppercase tracking-wide text-white/60">{L("Suivante", "التالية", "Next")}</div>
              {nextSlide ? (
                <div className="overflow-hidden rounded border border-white/20"><SlideView slide={nextSlide.s} deck={deck} scale={Math.min((size.w * 0.33) / deck.w, 0.4)} mode="thumb" L={L} /></div>
              ) : <div className="rounded border border-white/20 p-6 text-center text-white/60">{L("Fin du diaporama", "نهاية العرض", "End of show")}</div>}
              <div className="text-xs uppercase tracking-wide text-white/60">{L("Notes", "ملاحظات", "Notes")}</div>
              <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded bg-white/5 p-3 text-[17px] leading-relaxed" dir="auto">{cur?.s.notes || <span className="text-white/40">{L("Aucune note", "لا توجد ملاحظات", "No notes")}</span>}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          {stage}
          <div className="absolute bottom-4 start-4">{tools}</div>
        </div>
      )}
      {grid && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-black/90 p-8" onClick={() => setGrid(false)}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {visible.map((v, p) => (
              <button key={v.s.id} type="button" onClick={(e) => { e.stopPropagation(); setGrid(false); go(p); }} className={cn("overflow-hidden rounded border-2 text-start", p === pos ? "border-orange-500" : "border-transparent hover:border-white/50")}>
                <SlideView slide={v.s} deck={deck} scale={216 / deck.w} mode="thumb" L={L} />
                <div className="bg-black/60 px-2 py-0.5 text-xs text-white">{v.i + 1}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
