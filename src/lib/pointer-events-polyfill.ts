/**
 * Pointer Events minimal polyfill — iOS 12 / Safari 12 (iPad Air, iPad mini 2/3…)
 * ---------------------------------------------------------------------------
 * Safari n'a reçu les Pointer Events qu'à partir d'iOS 13. Or Radix UI
 * (Dialog, Sheet, AlertDialog, Select, DropdownMenu, Tooltip…) s'appuie sur
 * `pointerdown` / `pointerup` pour :
 *   - fermer une fenêtre/menu quand on touche à l'extérieur,
 *   - ouvrir certains menus (DropdownMenu ne s'ouvre QUE sur pointerdown).
 *
 * Ce module traduit les événements tactiles et souris natifs en événements
 * `pointer*` (qui remontent jusqu'à la racine React). Il ne s'active que si le
 * navigateur ne connaît pas `window.PointerEvent` : aucun effet sur Android,
 * Chrome, Firefox, Edge ni sur Safari ≥ 13.
 */

type AnyEvent = any;

export function installPointerEventsPolyfill(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const w = window as AnyEvent;
  if (w.PointerEvent) return;

  const MOUSE_ID = 1;
  const COMPAT_MOUSE_DELAY = 800; // ms : ignore les événements souris "simulés" après un toucher
  let lastTouchTime = 0;
  const activeTouches: Record<number, { target: EventTarget }> = {};
  let activeCount = 0;

  const createPointerEvent = (type: string, init: AnyEvent): Event => {
    let e: AnyEvent;
    try {
      e = new MouseEvent(type, init);
    } catch (_) {
      e = document.createEvent("MouseEvents");
      e.initMouseEvent(
        type, !!init.bubbles, !!init.cancelable, window, 0,
        init.screenX || 0, init.screenY || 0, init.clientX || 0, init.clientY || 0,
        !!init.ctrlKey, !!init.altKey, !!init.shiftKey, !!init.metaKey,
        init.button || 0, init.relatedTarget || null
      );
    }
    const extra: Record<string, unknown> = {
      pointerId: init.pointerId,
      pointerType: init.pointerType,
      isPrimary: !!init.isPrimary,
      width: init.width || 1,
      height: init.height || 1,
      pressure: init.pressure || 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
    };
    Object.keys(extra).forEach((k) => {
      try {
        Object.defineProperty(e, k, { value: extra[k], enumerable: true, configurable: true });
      } catch (_) { /* ignore */ }
    });
    if (typeof init.buttons === "number") {
      try { Object.defineProperty(e, "buttons", { value: init.buttons, enumerable: true, configurable: true }); } catch (_) { /* ignore */ }
    }
    return e as Event;
  };

  // Constructeur global (certaines bibliothèques testent `window.PointerEvent`)
  const PointerEventShim: AnyEvent = function (this: AnyEvent, type: string, init?: AnyEvent) {
    return createPointerEvent(type, init || {});
  };
  PointerEventShim.prototype = MouseEvent.prototype;
  w.PointerEvent = PointerEventShim;

  // Capture de pointeur : no-op (le tactile est déjà "capturé" par la cible du touchstart)
  const proto = Element.prototype as AnyEvent;
  if (!proto.setPointerCapture) proto.setPointerCapture = function () { /* no-op */ };
  if (!proto.releasePointerCapture) proto.releasePointerCapture = function () { /* no-op */ };
  if (!proto.hasPointerCapture) proto.hasPointerCapture = function () { return false; };

  const fire = (
    target: EventTarget | null,
    type: string,
    src: AnyEvent,
    p: { id: number; kind: "touch" | "mouse"; primary: boolean; button: number; buttons: number; related?: EventTarget | null },
    bubbles = true
  ) => {
    if (!target || !(target as AnyEvent).dispatchEvent) return;
    const ev = createPointerEvent(type, {
      bubbles,
      cancelable: type !== "pointerenter" && type !== "pointerleave",
      view: window,
      clientX: src.clientX, clientY: src.clientY,
      screenX: src.screenX, screenY: src.screenY,
      ctrlKey: !!src.ctrlKey, altKey: !!src.altKey, shiftKey: !!src.shiftKey, metaKey: !!src.metaKey,
      button: p.button,
      buttons: p.buttons,
      relatedTarget: p.related || null,
      pointerId: p.id,
      pointerType: p.kind,
      isPrimary: p.primary,
      width: src.radiusX ? src.radiusX * 2 : 1,
      height: src.radiusY ? src.radiusY * 2 : 1,
      pressure: p.buttons ? (src.force || 0.5) : 0,
    });
    target.dispatchEvent(ev);
  };

  /* ---------------------------- Tactile ---------------------------- */
  const onTouch = (e: AnyEvent) => {
    lastTouchTime = Date.now();
    const touches = e.changedTouches || [];
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      const id = t.identifier + 2; // 1 est réservé à la souris
      if (e.type === "touchstart") {
        const primary = activeCount === 0;
        activeTouches[id] = { target: t.target || e.target };
        activeCount++;
        const tgt = activeTouches[id].target;
        const info = { id, kind: "touch" as const, primary, button: 0, buttons: 1 };
        fire(tgt, "pointerover", t, info);
        fire(tgt, "pointerenter", t, info, false);
        fire(tgt, "pointerdown", t, info);
      } else if (e.type === "touchmove") {
        const rec = activeTouches[id];
        if (!rec) continue;
        fire(rec.target, "pointermove", t, { id, kind: "touch", primary: true, button: -1, buttons: 1 });
      } else {
        const rec = activeTouches[id];
        if (!rec) continue;
        const info = { id, kind: "touch" as const, primary: true, button: 0, buttons: 0 };
        fire(rec.target, e.type === "touchcancel" ? "pointercancel" : "pointerup", t, info);
        fire(rec.target, "pointerout", t, info);
        fire(rec.target, "pointerleave", t, info, false);
        delete activeTouches[id];
        activeCount = Math.max(0, activeCount - 1);
      }
    }
  };

  /* ----------------------------- Souris ----------------------------- */
  const MOUSE_MAP: Record<string, string> = {
    mousedown: "pointerdown",
    mousemove: "pointermove",
    mouseup: "pointerup",
    mouseover: "pointerover",
    mouseout: "pointerout",
  };
  const onMouse = (e: AnyEvent) => {
    // Sur iPad, Safari génère des événements souris après chaque toucher : on les ignore
    if (Date.now() - lastTouchTime < COMPAT_MOUSE_DELAY) return;
    const type = MOUSE_MAP[e.type];
    if (!type) return;
    fire(e.target, type, e, {
      id: MOUSE_ID,
      kind: "mouse",
      primary: true,
      button: e.type === "mousemove" ? -1 : e.button,
      buttons: typeof e.buttons === "number" ? e.buttons : (e.type === "mousedown" ? 1 : 0),
      related: e.relatedTarget,
    });
  };

  const opts: AnyEvent = { capture: true, passive: true };
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach((t) => document.addEventListener(t, onTouch, opts));
  Object.keys(MOUSE_MAP).forEach((t) => document.addEventListener(t, onMouse, true));
}
