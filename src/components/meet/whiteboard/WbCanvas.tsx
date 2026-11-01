"use client";

/**
 * Surface de dessin (deux <canvas> superposés) :
 *  - "base" : fond + éléments terminés (redessiné seulement quand le document ou la vue change)
 *  - "top"  : trait en cours, aperçu de forme, laser, sélection, curseurs (redessiné à chaque image utile)
 * Utilisée pour le tableau infini ("board") et pour l'annotation de l'écran partagé ("overlay").
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUpToLine, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCREEN_W, uid, type El, type Layer, type View, type WbStore } from "./model";
import { THEMES, FONT, NOTE_TEXT, initFont, bounds, color as resolveColor, drawEl, drawLaser, drawPaper, hit, intersects, isRtl, measureText, recognize, scaleEl, union, type Box, type Cam } from "./render";
import type { ToolState } from "./tools";
import type { Tr } from "../useTr";

export interface WbCanvasHandle {
  zoomBy: (f: number) => void;
  setZoom: (z: number) => void;
  fit: () => void;
  getZoom: () => number;
  insertImage: (src: string, w: number, h: number) => void;
  center: () => { x: number; y: number };
  deleteSelection: () => void;
}

interface Props {
  store: WbStore;
  layer: Layer;
  variant: "board" | "overlay";
  tools: ToolState;
  /** l'utilisateur peut dessiner (sinon : navigation seule) */
  active: boolean;
  tr: Tr;
  /** élève : suivre la vue du professeur */
  follow?: boolean;
  onUserNavigate?: () => void;
  onZoom?: (z: number) => void;
  onSelection?: (n: number) => void;
  className?: string;
}

type Gesture =
  | { k: "ink"; el: El; last: [number, number]; sent: number; timer: number }
  | { k: "erase"; ids: Set<string>; x: number; y: number }
  | { k: "laser"; buf: number[]; timer: number }
  | { k: "shape"; x0: number; y0: number; el: El | null }
  | { k: "move"; x0: number; y0: number; orig: Map<string, El>; moved: boolean; t: number }
  | { k: "resize"; ax: number; ay: number; d0: number; orig: Map<string, El>; t: number }
  | { k: "marquee"; x0: number; y0: number; x1: number; y1: number; add: boolean }
  | { k: "pan"; sx: number; sy: number; cx: number; cy: number }
  | { k: "pinch"; d0: number; z0: number; wx: number; wy: number };

interface Editing {
  id: string | null;
  k: "text" | "note";
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color: string;
  text: string;
}

const MIN_Z = 0.08;
const MAX_Z = 8;
const ERASER_PX = 12;

export const WbCanvas = forwardRef<WbCanvasHandle, Props>(function WbCanvas(props, ref) {
  const { store, layer, variant, tools, active, tr } = props;
  const board = variant === "board";
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);
  const selBarRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const cam = useRef<Cam>({ x: -80, y: -60, z: 1 });
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const penSeen = useRef(false);
  const space = useRef(false);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const lastCursor = useRef(0);
  const lastDown = useRef({ t: 0, x: 0, y: 0 });
  const [selection, setSelectionState] = useState<string[]>([]);
  const sel = useRef<string[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);
  editingRef.current = editing;
  const dirty = useRef({ base: true, top: true });
  const raf = useRef(0);
  const drawnVersion = useRef(-1);
  const propsRef = useRef(props);
  propsRef.current = props;

  const setSelection = useCallback((ids: string[]) => {
    sel.current = ids;
    setSelectionState(ids);
    propsRef.current.onSelection?.(ids.length);
    dirty.current.top = true;
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ caméra
  const syncOverlayCam = () => {
    if (!board) cam.current = { x: 0, y: 0, z: size.current.w / SCREEN_W || 1 };
  };
  const toWorld = (cx: number, cy: number) => {
    const r = topRef.current!.getBoundingClientRect();
    const c = cam.current;
    return { x: (cx - r.left) / c.z + c.x, y: (cy - r.top) / c.z + c.y };
  };
  const viewOf = (): View => {
    const { w, h } = size.current;
    const c = cam.current;
    return { cx: c.x + w / c.z / 2, cy: c.y + h / c.z / 2, vw: w / c.z, vh: h / c.z };
  };
  const lastView = useRef(0);
  const viewTimer = useRef(0);
  const camChanged = (byUser: boolean) => {
    dirty.current.base = dirty.current.top = true;
    schedule();
    propsRef.current.onZoom?.(cam.current.z);
    if (byUser && !store.isHost) propsRef.current.onUserNavigate?.();
    if (board && store.isHost) {
      // la vue du professeur est envoyée (au plus 8 fois par seconde)
      const now = Date.now();
      window.clearTimeout(viewTimer.current);
      if (now - lastView.current > 120) {
        lastView.current = now;
        store.sendView(viewOf());
      } else viewTimer.current = window.setTimeout(() => store.sendView(viewOf()), 140);
    }
  };
  const zoomAt = (sx: number, sy: number, f: number) => {
    const c = cam.current;
    const z = Math.min(MAX_Z, Math.max(MIN_Z, c.z * f));
    const wx = sx / c.z + c.x,
      wy = sy / c.z + c.y;
    cam.current = { z, x: wx - sx / z, y: wy - sy / z };
    camChanged(true);
  };
  const fitBox = (b: Box | null, byUser: boolean) => {
    const { w, h } = size.current;
    if (!w || !h) return;
    if (!b) {
      cam.current = { x: -w / 2, y: -h / 2, z: 1 };
    } else {
      const pad = 60;
      const z = Math.min(MAX_Z, Math.max(MIN_Z, Math.min((w - pad * 2) / Math.max(b.w, 1), (h - pad * 2) / Math.max(b.h, 1), 2)));
      cam.current = { z, x: b.x + b.w / 2 - w / z / 2, y: b.y + b.h / 2 - h / z / 2 };
    }
    camChanged(byUser);
  };
  const applyHostView = () => {
    const v = store.hostView;
    const { w, h } = size.current;
    if (!v || !w || !h) return;
    const z = Math.min(MAX_Z, Math.max(MIN_Z, Math.min(w / v.vw, h / v.vh)));
    cam.current = { z, x: v.cx - w / z / 2, y: v.cy - h / z / 2 };
    camChanged(false);
  };

  useImperativeHandle(ref, () => ({
    zoomBy: f => zoomAt(size.current.w / 2, size.current.h / 2, f),
    setZoom: z => zoomAt(size.current.w / 2, size.current.h / 2, z / cam.current.z),
    fit: () => fitBox(union(store.list(layer).map(bounds)), true),
    getZoom: () => cam.current.z,
    center: () => {
      const v = viewOf();
      return { x: v.cx, y: v.cy };
    },
    insertImage: (src, iw, ih) => {
      const v = viewOf();
      const k = Math.min(1, (v.vw * 0.6) / iw, (v.vh * 0.6) / ih);
      const el: El = { id: uid(), by: store.me, k: "image", x: v.cx - (iw * k) / 2, y: v.cy - (ih * k) / 2, w: iw * k, h: ih * k, color: "fg", size: 1, src };
      store.add(layer, [el]);
      setSelection([el.id]);
    },
    deleteSelection: () => {
      store.remove(layer, sel.current);
      setSelection([]);
    },
  }));

  // ------------------------------------------------------------------ dessin
  const schedule = () => {
    if (!raf.current) raf.current = requestAnimationFrame(frame);
  };
  const onImage = () => {
    dirty.current.base = true;
    schedule();
  };

  function drawBase() {
    const c = baseRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { w, h, dpr } = size.current;
    const cm = cam.current;
    const st = { ...store.state, theme: board ? store.state.theme : ("light" as const) };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (board) drawPaper(ctx, st.theme, st.paper, cm, w, h);
    else ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr * cm.z, 0, 0, dpr * cm.z, -cm.x * cm.z * dpr, -cm.y * cm.z * dpr);
    const view: Box = { x: cm.x, y: cm.y, w: w / cm.z, h: h / cm.z };
    const g = gesture.current;
    const live = g?.k === "ink" ? g.el.id : null;
    const erasing = g?.k === "erase" ? g.ids : null;
    const editingId = editingRef.current?.id;
    for (const e of store.docs[layer].values()) {
      if (e.exp || e.id === live || e.id === editingId) continue;
      if (!intersects(bounds(e), view)) continue;
      if (erasing?.has(e.id)) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        drawEl(ctx, e, st.theme, onImage);
        ctx.restore();
        continue;
      }
      drawEl(ctx, e, st.theme, onImage);
    }
  }

  function drawTop(now: number) {
    const c = topRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { w, h, dpr } = size.current;
    const cm = cam.current;
    const theme = board ? store.state.theme : "light";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr * cm.z, 0, 0, dpr * cm.z, -cm.x * cm.z * dpr, -cm.y * cm.z * dpr);
    // encre éphémère (fondu)
    for (const e of store.docs[layer].values()) if (e.exp) drawEl(ctx, e, theme, onImage, now);
    const g = gesture.current;
    if (g?.k === "ink") drawEl(ctx, g.el, theme, onImage, g.el.ttl ? 0 : 0);
    if (g?.k === "shape" && g.el) drawEl(ctx, g.el, theme, onImage);
    for (const t of store.lasers.values()) if (t.l === layer) drawLaser(ctx, t, now, cm.z);
    // sélection
    const ids = sel.current;
    const bar = selBarRef.current;
    if (ids.length) {
      const els = ids.map(id => store.get(layer, id)).filter(Boolean) as El[];
      const u = union(els.map(bounds));
      if (u) {
        ctx.save();
        ctx.lineWidth = 1 / cm.z;
        ctx.strokeStyle = "#6366f1";
        ctx.setLineDash([5 / cm.z, 4 / cm.z]);
        if (els.length > 1)
          for (const e of els) {
            const b = bounds(e);
            ctx.strokeRect(b.x, b.y, b.w, b.h);
          }
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5 / cm.z;
        const p = 6 / cm.z;
        ctx.strokeRect(u.x - p, u.y - p, u.w + p * 2, u.h + p * 2);
        // poignée de redimensionnement
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(u.x + u.w + p, u.y + u.h + p, 6 / cm.z, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (bar) {
          const sx = (u.x + u.w / 2 - cm.x) * cm.z;
          const sy = (u.y - cm.y) * cm.z - 14;
          bar.style.display = g && (g.k === "move" || g.k === "resize") ? "none" : "flex";
          bar.style.transform = `translate(calc(${Math.round(sx)}px - 50%), calc(${Math.round(Math.max(48, sy))}px - 100%))`;
        }
      } else if (bar) bar.style.display = "none";
    } else if (bar) bar.style.display = "none";
    if (g?.k === "marquee") {
      ctx.save();
      ctx.fillStyle = "rgba(99,102,241,0.08)";
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 1 / cm.z;
      const x = Math.min(g.x0, g.x1),
        y = Math.min(g.y0, g.y1);
      ctx.fillRect(x, y, Math.abs(g.x1 - g.x0), Math.abs(g.y1 - g.y0));
      ctx.strokeRect(x, y, Math.abs(g.x1 - g.x0), Math.abs(g.y1 - g.y0));
      ctx.restore();
    }
    // gomme : cercle sous le pointeur
    const hv = hover.current;
    if (active && propsRef.current.tools.tool === "eraser" && hv) {
      ctx.save();
      ctx.lineWidth = 1.5 / cm.z;
      ctx.strokeStyle = theme === "light" || !board ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.7)";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(hv.x, hv.y, ERASER_PX / cm.z, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // curseurs des autres (étiquette en pixels écran)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const [, p] of store.peers) {
      if (p.l !== layer || now - p.t > 3500) continue;
      const sx = (p.x - cm.x) * cm.z,
        sy = (p.y - cm.y) * cm.z;
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (3500 - (now - p.t)) / 800);
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 4, sy + 14);
      ctx.lineTo(sx + 7.5, sy + 8.5);
      ctx.lineTo(sx + 14, sy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const name = p.name || "…";
      ctx.font = `600 11px ${FONT}`;
      const tw = ctx.measureText(name).width;
      ctx.fillStyle = "#6366f1";
      (ctx as any).roundRect ? (ctx as any).roundRect(sx + 10, sy + 14, tw + 12, 18, 9) : ctx.rect(sx + 10, sy + 14, tw + 12, 18);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(name, sx + 16, sy + 23.5);
      ctx.restore();
    }
  }

  function frame() {
    raf.current = 0;
    const now = Date.now();
    const animating = store.prune(now);
    if (store.version !== drawnVersion.current) {
      drawnVersion.current = store.version;
      dirty.current.base = true;
    }
    if (dirty.current.base) {
      dirty.current.base = false;
      drawBase();
    }
    drawTop(now);
    dirty.current.top = false;
    if (animating || gesture.current?.k === "laser") schedule();
    else if (store.peers.size) window.setTimeout(schedule, 500);
  }

  // abonnement au magasin
  useEffect(() => {
    const un = store.subscribe(() => {
      dirty.current.top = true;
      schedule();
    });
    const unState = store.subscribeState(() => {
      dirty.current.base = true;
      // sélection : retirer ce qui a disparu
      if (sel.current.some(id => !store.get(layer, id))) setSelection(sel.current.filter(id => store.get(layer, id)));
      schedule();
    });
    return () => {
      un();
      unState();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, layer]);

  // vue du professeur (élèves)
  useEffect(() => {
    if (!board || store.isHost || !props.follow) return;
    applyHostView();
    return store.subscribeView(applyHostView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.follow, board, store]);

  // taille
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    initFont();
    let first = true;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(1, e.contentRect.width),
        h = Math.max(1, e.contentRect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const prev = size.current;
      size.current = { w, h, dpr };
      for (const c of [baseRef.current, topRef.current]) {
        if (!c) continue;
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      if (board) {
        if (first) {
          if (!store.isHost && propsRef.current.follow && store.hostView) applyHostView();
          else {
            const b = union(store.list(layer).map(bounds));
            if (b) fitBox(b, false);
            else cam.current = { x: -w / 2 + 40, y: -h / 2 + 40, z: 1 };
            // origine visible : marge du cahier Seyès à gauche
            if (!b) cam.current = { x: -Math.min(120, w * 0.12), y: -40, z: 1 };
          }
        } else if (prev.w && !store.isHost && propsRef.current.follow) applyHostView();
      } else syncOverlayCam();
      first = false;
      dirty.current.base = dirty.current.top = true;
      frame();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, store, layer]);

  // redessiner quand l'outil change (curseur de gomme)
  useEffect(() => {
    dirty.current.top = true;
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools.tool, active]);

  // sélection perdue si on change d'outil ou de droits
  useEffect(() => {
    if (tools.tool !== "select" && sel.current.length) setSelection([]);
  }, [tools.tool, setSelection]);
  useEffect(() => {
    if (!active) {
      setSelection([]);
      setEditing(null);
    }
  }, [active, setSelection]);

  // molette : déplacement / zoom (tableau seulement)
  useEffect(() => {
    const c = topRef.current;
    if (!c || !board) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (editingRef.current) return;
      const r = c.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)));
      } else {
        const k = e.deltaMode ? 30 : 1;
        cam.current = { ...cam.current, x: cam.current.x + (e.shiftKey ? e.deltaY : e.deltaX) * k / cam.current.z, y: cam.current.y + (e.shiftKey ? 0 : e.deltaY) * k / cam.current.z };
        camChanged(true);
      }
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // clavier : espace (main), suppr, dupliquer, échap, annuler
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === " " && board) {
        space.current = true;
        if (topRef.current) topRef.current.style.cursor = "grab";
        e.preventDefault();
        return;
      }
      if (!active) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel.current.length) {
        store.remove(layer, sel.current);
        setSelection([]);
        e.preventDefault();
      } else if (e.key === "Escape") {
        setSelection([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && sel.current.length) {
        e.preventDefault();
        duplicate();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && propsRef.current.tools.tool === "select") {
        e.preventDefault();
        setSelection(store.list(layer).filter(el => store.canEdit(el)).map(el => el.id));
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        space.current = false;
        if (topRef.current) topRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, board, layer, store]);

  const duplicate = () => {
    const els = sel.current.map(id => store.get(layer, id)).filter(Boolean) as El[];
    const off = 24 / cam.current.z;
    const copies = els.map(e => ({ ...e, id: uid(), by: store.me, x: e.x + off, y: e.y + off }));
    store.add(layer, copies);
    setSelection(copies.map(c => c.id));
  };

  // ------------------------------------------------------------------ texte
  const openEditor = (ed: Editing) => {
    setSelection([]);
    setEditing(ed);
    dirty.current.base = true;
    schedule();
  };
  useEffect(() => {
    if (!editing) return;
    const t = editRef.current;
    if (!t) return;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, editing?.x, editing?.y]);
  const commitEdit = () => {
    const ed = editingRef.current;
    if (!ed) return;
    setEditing(null);
    editingRef.current = null;
    const text = (editRef.current?.value ?? ed.text).replace(/\s+$/, "");
    if (ed.k === "text") {
      const m = measureText(text, ed.size);
      if (!ed.id) {
        if (text.trim()) store.add(layer, [{ id: uid(), by: store.me, k: "text", x: ed.x, y: ed.y, w: m.w, h: m.h, size: ed.size, color: ed.color, text }]);
      } else if (!text.trim()) store.remove(layer, [ed.id]);
      else store.update(layer, ed.id, { text, w: m.w, h: m.h });
    } else if (ed.id) {
      const cur = store.get(layer, ed.id);
      if (cur && cur.text !== text) store.update(layer, ed.id, { text });
    }
    dirty.current.base = true;
    schedule();
  };

  // ------------------------------------------------------------------ pointeur
  const topAt = (x: number, y: number, tol: number, editableOnly = false) => {
    const els = store.list(layer);
    for (let i = els.length - 1; i >= 0; i--) {
      const e = els[i];
      if (e.exp) continue;
      if (editableOnly && !store.canEdit(e)) continue;
      if (hit(e, x, y, tol)) return e;
    }
    return null;
  };

  const flushInk = (g: Extract<Gesture, { k: "ink" }>) => {
    const pts = g.el.pts!;
    if (pts.length > g.sent) {
      store.append(layer, g.el.id, pts.slice(g.sent), true);
      g.sent = pts.length;
    }
  };

  const sendCursor = (x: number, y: number, down: boolean) => {
    if (!store.canWrite) return;
    const now = Date.now();
    if (now - lastCursor.current < 70) return;
    lastCursor.current = now;
    store.sendCursor(layer, x, y, down);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // pas d'événements souris de compatibilité : le champ de texte garde le focus
    e.preventDefault();
    if (editingRef.current) {
      commitEdit();
      return;
    }
    const c = topRef.current!;
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (e.pointerType === "pen") penSeen.current = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const r = c.getBoundingClientRect();

    // deux doigts : zoom / déplacement
    if (board && pointers.current.size === 2) {
      const g = gesture.current;
      if (g?.k === "ink") {
        window.clearInterval(g.timer);
        store.abort(layer, g.el.id);
      }
      const [a, b] = Array.from(pointers.current.values());
      const mx = (a.x + b.x) / 2 - r.left,
        my = (a.y + b.y) / 2 - r.top;
      gesture.current = { k: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.current.z, wx: mx / cam.current.z + cam.current.x, wy: my / cam.current.z + cam.current.y };
      return;
    }
    if (pointers.current.size > 1) return;

    const p = toWorld(e.clientX, e.clientY);
    const z = cam.current.z;
    const tool = propsRef.current.tools.tool;
    const tl = propsRef.current.tools;
    const panGesture =
      board && (!active || tool === "pan" || space.current || e.button === 1 || (e.pointerType === "touch" && penSeen.current));
    if (panGesture) {
      gesture.current = { k: "pan", sx: e.clientX, sy: e.clientY, cx: cam.current.x, cy: cam.current.y };
      c.style.cursor = "grabbing";
      return;
    }
    if (!active || e.button === 2) return;

    // double-clic : modifier un texte / une note
    const now = Date.now();
    const dbl = now - lastDown.current.t < 350 && Math.hypot(e.clientX - lastDown.current.x, e.clientY - lastDown.current.y) < 8;
    lastDown.current = { t: now, x: e.clientX, y: e.clientY };
    if (dbl && (tool === "select" || tool === "text")) {
      const t = topAt(p.x, p.y, 4 / z, true);
      if (t && (t.k === "text" || t.k === "note")) {
        gesture.current = null;
        openEditor({ id: t.id, k: t.k, x: t.x, y: t.y, w: t.w, h: t.h, size: t.size, color: t.color, text: t.text || "" });
        return;
      }
    }

    if (tool === "pen" || tool === "highlighter") {
      const hl = tool === "highlighter";
      const el: El = {
        id: uid(),
        by: store.me,
        k: "ink",
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
        color: hl ? tl.hlColor : tl.color,
        size: (hl ? tl.hl : tl.pen) / z,
        pts: [0, 0, e.pressure || 0.5],
      };
      if (hl) el.hl = true;
      if (e.pointerType === "pen") el.pr = true;
      if (tl.ephemeral && !hl) el.ttl = 4000;
      store.begin(layer, el);
      const g: Gesture = { k: "ink", el, last: [p.x, p.y], sent: 3, timer: 0 };
      g.timer = window.setInterval(() => flushInk(g), 45);
      gesture.current = g;
    } else if (tool === "eraser") {
      const g: Gesture = { k: "erase", ids: new Set(), x: p.x, y: p.y };
      gesture.current = g;
      eraseAt(g, p.x, p.y);
    } else if (tool === "laser") {
      const now2 = Date.now();
      store.lasers.set(store.me, { l: layer, pts: [p.x, p.y, now2], mine: true });
      const g: Gesture = { k: "laser", buf: [p.x, p.y], timer: 0 };
      g.timer = window.setInterval(() => {
        if (g.buf.length) {
          store.sendLaser(layer, g.buf);
          g.buf = [];
        }
      }, 50);
      gesture.current = g;
    } else if (tool === "shape") {
      gesture.current = { k: "shape", x0: p.x, y0: p.y, el: null };
    } else if (tool === "text") {
      const t = topAt(p.x, p.y, 4 / z, true);
      if (t && t.k === "text") {
        openEditor({ id: t.id, k: "text", x: t.x, y: t.y, w: t.w, h: t.h, size: t.size, color: t.color, text: t.text || "" });
      } else {
        const size = 26 / z;
        openEditor({ id: null, k: "text", x: p.x, y: p.y - size * 0.6, w: 0, h: 0, size, color: tl.color, text: "" });
      }
    } else if (tool === "note") {
      const s = 220 / z;
      const el: El = { id: uid(), by: store.me, k: "note", x: p.x - s / 2, y: p.y - s / 2, w: s, h: s, size: 22 / z, color: tl.noteColor, text: "" };
      store.add(layer, [el]);
      openEditor({ id: el.id, k: "note", x: el.x, y: el.y, w: el.w, h: el.h, size: el.size, color: el.color, text: "" });
    } else if (tool === "select") {
      const ids = sel.current;
      if (ids.length) {
        const u = union(ids.map(id => store.get(layer, id)).filter(Boolean).map(x => bounds(x as El)));
        const pad = 6 / z;
        if (u && Math.hypot(p.x - (u.x + u.w + pad), p.y - (u.y + u.h + pad)) < 12 / z) {
          const orig = new Map(ids.map(id => [id, store.get(layer, id)!] as const).filter(([, v]) => v));
          gesture.current = { k: "resize", ax: u.x, ay: u.y, d0: Math.max(1, Math.hypot(p.x - u.x, p.y - u.y)), orig, t: 0 };
          return;
        }
      }
      const t = topAt(p.x, p.y, 5 / z);
      if (t) {
        let next = ids;
        if (e.shiftKey) next = ids.includes(t.id) ? ids.filter(i => i !== t.id) : [...ids, t.id];
        else if (!ids.includes(t.id)) next = [t.id];
        setSelection(next);
        const movable = next.map(id => store.get(layer, id)).filter((x): x is El => !!x && store.canEdit(x));
        gesture.current = { k: "move", x0: p.x, y0: p.y, orig: new Map(movable.map(x => [x.id, x])), moved: false, t: 0 };
      } else {
        if (!e.shiftKey) setSelection([]);
        gesture.current = { k: "marquee", x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey };
      }
    }
    dirty.current.top = true;
    schedule();
  };

  const eraseAt = (g: Extract<Gesture, { k: "erase" }>, x: number, y: number) => {
    const tol = ERASER_PX / cam.current.z;
    // interpolation entre deux positions (gestes rapides)
    const steps = Math.max(1, Math.ceil(Math.hypot(x - g.x, y - g.y) / (tol * 0.8)));
    let changed = false;
    for (let s = 1; s <= steps; s++) {
      const px = g.x + ((x - g.x) * s) / steps,
        py = g.y + ((y - g.y) * s) / steps;
      for (const e of store.docs[layer].values()) {
        if (g.ids.has(e.id) || !store.canEdit(e)) continue;
        if (hit(e, px, py, tol)) {
          g.ids.add(e.id);
          changed = true;
        }
      }
    }
    g.x = x;
    g.y = y;
    if (changed) dirty.current.base = true;
  };

  const shapeFrom = (x0: number, y0: number, x1: number, y1: number, shift: boolean): El => {
    const tl = propsRef.current.tools;
    const z = cam.current.z;
    const base = { id: uid(), by: store.me, k: "shape" as const, color: tl.color, size: tl.pen / z, shape: tl.shape, fill: tl.fill || undefined, dash: tl.dash || undefined };
    if (tl.shape === "line" || tl.shape === "arrow" || tl.shape === "dline") {
      let dx = x1 - x0,
        dy = y1 - y0;
      if (shift) {
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const l = Math.hypot(dx, dy);
        dx = Math.cos(a) * l;
        dy = Math.sin(a) * l;
      }
      return { ...base, x: x0, y: y0, w: dx, h: dy };
    }
    let w = x1 - x0,
      h = y1 - y0;
    if (shift) {
      const m = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * m;
      h = Math.sign(h || 1) * m;
    }
    return { ...base, x: Math.min(x0, x0 + w), y: Math.min(y0, y0 + h), w: Math.abs(w), h: Math.abs(h) };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = pointers.current.get(e.pointerId);
    if (pt) {
      pt.x = e.clientX;
      pt.y = e.clientY;
    }
    const g = gesture.current;
    const p = toWorld(e.clientX, e.clientY);
    hover.current = p;
    if (!g) {
      if (active) sendCursor(p.x, p.y, false);
      if (active && propsRef.current.tools.tool === "eraser") {
        dirty.current.top = true;
        schedule();
      }
      return;
    }
    const z = cam.current.z;
    switch (g.k) {
      case "pinch": {
        const pts = Array.from(pointers.current.values());
        if (pts.length < 2) return;
        const [a, b] = pts;
        const r = topRef.current!.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left,
          my = (a.y + b.y) / 2 - r.top;
        const nz = Math.min(MAX_Z, Math.max(MIN_Z, (g.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0));
        cam.current = { z: nz, x: g.wx - mx / nz, y: g.wy - my / nz };
        camChanged(true);
        return;
      }
      case "pan":
        cam.current = { ...cam.current, x: g.cx - (e.clientX - g.sx) / z, y: g.cy - (e.clientY - g.sy) / z };
        camChanged(true);
        return;
      case "ink": {
        const evs = (e.nativeEvent as any).getCoalescedEvents?.() || [e.nativeEvent];
        const pts = g.el.pts!;
        for (const ev of evs) {
          const q = toWorld(ev.clientX, ev.clientY);
          if (Math.hypot(q.x - g.last[0], q.y - g.last[1]) < 0.8 / z) continue;
          g.last = [q.x, q.y];
          pts.push(Math.round((q.x - g.el.x) * 100) / 100, Math.round((q.y - g.el.y) * 100) / 100, Math.round((ev.pressure || 0.5) * 100) / 100);
        }
        g.el = { ...g.el };
        sendCursor(p.x, p.y, true);
        break;
      }
      case "erase":
        eraseAt(g, p.x, p.y);
        break;
      case "laser": {
        const t = store.lasers.get(store.me) || { l: layer, pts: [], mine: true };
        t.pts.push(p.x, p.y, Date.now());
        store.lasers.set(store.me, t);
        g.buf.push(p.x, p.y);
        break;
      }
      case "shape":
        g.el = shapeFrom(g.x0, g.y0, p.x, p.y, e.shiftKey);
        break;
      case "move": {
        const dx = p.x - g.x0,
          dy = p.y - g.y0;
        if (!g.moved && Math.hypot(dx, dy) * z < 3) return;
        g.moved = true;
        const now = Date.now();
        if (now - g.t < 32) return;
        g.t = now;
        for (const [id, o] of g.orig) store.live(layer, id, { x: o.x + dx, y: o.y + dy });
        break;
      }
      case "resize": {
        const f = Math.max(0.05, Math.hypot(p.x - g.ax, p.y - g.ay) / g.d0);
        const now = Date.now();
        if (now - g.t < 32) return;
        g.t = now;
        for (const [id, o] of g.orig) store.live(layer, id, scaleEl(o, g.ax, g.ay, f));
        break;
      }
      case "marquee":
        g.x1 = p.x;
        g.y1 = p.y;
        break;
    }
    dirty.current.top = true;
    schedule();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.k === "pinch") {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (topRef.current) topRef.current.style.cursor = "";
    const p = toWorld(e.clientX, e.clientY);
    switch (g.k) {
      case "ink": {
        window.clearInterval(g.timer);
        flushInk(g);
        const doc = store.get(layer, g.el.id);
        const rec = propsRef.current.tools.smart && !g.el.hl && !g.el.ttl && doc ? recognize(doc) : null;
        store.finish(layer, g.el.id, rec || undefined);
        break;
      }
      case "erase":
        if (g.ids.size) store.remove(layer, Array.from(g.ids));
        break;
      case "laser":
        window.clearInterval(g.timer);
        if (g.buf.length) store.sendLaser(layer, g.buf);
        schedule();
        break;
      case "shape": {
        const el = shapeFrom(g.x0, g.y0, p.x, p.y, e.shiftKey);
        if (Math.hypot(el.w, el.h) * cam.current.z > 4) store.add(layer, [el]);
        break;
      }
      case "move":
        if (g.moved) {
          const dx = p.x - g.x0,
            dy = p.y - g.y0;
          store.updateMany(
            layer,
            Array.from(g.orig.values()).map(o => ({ id: o.id, p: { x: o.x + dx, y: o.y + dy }, before: { x: o.x, y: o.y } })),
          );
        }
        break;
      case "resize": {
        const f = Math.max(0.05, Math.hypot(p.x - g.ax, p.y - g.ay) / g.d0);
        store.updateMany(
          layer,
          Array.from(g.orig.values()).map(o => {
            const patch = scaleEl(o, g.ax, g.ay, f);
            const before: Partial<El> = {};
            for (const k of Object.keys(patch) as (keyof El)[]) (before as any)[k] = o[k];
            return { id: o.id, p: patch, before };
          }),
        );
        break;
      }
      case "marquee": {
        const box: Box = { x: Math.min(g.x0, g.x1), y: Math.min(g.y0, g.y1), w: Math.abs(g.x1 - g.x0), h: Math.abs(g.y1 - g.y0) };
        if (box.w * cam.current.z > 3 || box.h * cam.current.z > 3) {
          const ids = store.list(layer).filter(el => !el.exp && intersects(bounds(el), box)).map(el => el.id);
          setSelection(g.add ? Array.from(new Set([...sel.current, ...ids])) : ids);
        }
        break;
      }
    }
    dirty.current.base = dirty.current.top = true;
    schedule();
  };

  const onPointerLeave = () => {
    hover.current = null;
    dirty.current.top = true;
    schedule();
  };

  // ------------------------------------------------------------------ rendu
  const tool = tools.tool;
  const cursor = !active
    ? board
      ? "grab"
      : "default"
    : tool === "pan"
      ? "grab"
      : tool === "select"
        ? "default"
        : tool === "text"
          ? "text"
          : tool === "eraser"
            ? "none"
            : tool === "laser"
              ? "crosshair"
              : "crosshair";

  const ed = editing;
  const cm = cam.current;
  const theme = board ? store.state.theme : "light";
  const fg = THEMES[theme].fg;
  const canInteract = board || active;

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full overflow-hidden", props.className)} dir="ltr">
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={topRef}
        className={cn("absolute inset-0 h-full w-full", canInteract ? "touch-none" : "pointer-events-none")}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={e => e.preventDefault()}
      />
      {/* actions sur la sélection */}
      <div
        ref={selBarRef}
        className="absolute left-0 top-0 z-10 hidden items-center gap-0.5 rounded-full bg-[#151b27] p-1 text-white shadow-xl ring-1 ring-white/10"
        style={{ display: "none" }}
      >
        <SelBtn label={tr("Dupliquer (Ctrl+D)", "تكرار (Ctrl+D)", "Duplicate (Ctrl+D)")} onClick={duplicate}>
          <Copy className="h-4 w-4" />
        </SelBtn>
        <SelBtn label={tr("Mettre au premier plan", "إحضار إلى الأمام", "Bring to front")} onClick={() => store.front(layer, sel.current)}>
          <ArrowUpToLine className="h-4 w-4" />
        </SelBtn>
        <span className="mx-0.5 h-5 w-px bg-white/15" />
        {["fg", "#e11d48", "#2563eb", "#16a34a", "#f59e0b"].map(c => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => {
              const changes = sel.current
                .map(id => store.get(layer, id))
                .filter((x): x is El => !!x && x.k !== "image" && x.k !== "note")
                .map(x => ({ id: x.id, p: { color: c }, before: { color: x.color } }));
              store.updateMany(layer, changes);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
          >
            <span className="h-4 w-4 rounded-full ring-2 ring-white/30" style={{ background: c === "fg" ? fg : c }} />
          </button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-white/15" />
        <SelBtn
          label={tr("Supprimer (Suppr)", "حذف (Delete)", "Delete (Del)")}
          danger
          onClick={() => {
            store.remove(layer, sel.current);
            setSelection([]);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </SelBtn>
      </div>
      {/* éditeur de texte / note */}
      {ed && (
        <textarea
          ref={editRef}
          defaultValue={ed.text}
          dir="auto"
          spellCheck
          placeholder={ed.k === "note" ? tr("Écrire une note…", "اكتب ملاحظة…", "Write a note…") : tr("Tapez votre texte…", "اكتب النص…", "Type text…")}
          onBlur={commitEdit}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
              e.preventDefault();
              commitEdit();
            }
          }}
          onInput={e => {
            if (ed.k !== "text") return;
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = t.scrollHeight + "px";
            const m = measureText(t.value || " ", ed.size);
            t.style.width = Math.max(m.w * cm.z + 24, 160) + "px";
          }}
          className={cn(
            "absolute z-20 resize-none overflow-hidden border-0 bg-transparent p-0 font-semibold outline-none placeholder:opacity-50",
            ed.k === "text" && "rounded-md ring-2 ring-indigo-500/60",
          )}
          style={{
            left: (ed.x - cm.x) * cm.z,
            top: (ed.y - cm.y) * cm.z,
            fontFamily: FONT,
            fontSize: ed.size * cm.z,
            lineHeight: ed.k === "note" ? 1.3 : 1.25,
            color: ed.k === "note" ? NOTE_TEXT : resolveColor(ed.color, theme),
            ...(ed.k === "note"
              ? {
                  width: ed.w * cm.z,
                  height: ed.h * cm.z,
                  background: ed.color,
                  padding: `${ed.h * cm.z * 0.09 + ed.w * cm.z * 0.064}px ${ed.w * cm.z * 0.08}px ${ed.w * cm.z * 0.08}px`,
                  borderRadius: 6,
                  boxShadow: "0 8px 24px rgba(0,0,0,.25)",
                }
              : { minWidth: 160, width: Math.max(ed.w * cm.z + 24, 160), height: Math.max(ed.size * cm.z * 1.25, ed.h * cm.z) + 4, padding: "0 2px", textAlign: isRtl(ed.text) ? "right" : undefined }),
          }}
        />
      )}
      <span className="sr-only">{selection.length ? `${selection.length}` : ""}</span>
    </div>
  );
});

function SelBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10", danger && "text-rose-300 hover:bg-rose-500/20")}
    >
      {children}
    </button>
  );
}
