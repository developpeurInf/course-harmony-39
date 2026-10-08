import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Protection anti-triche pendant un quiz (côté élève).
 *
 * Ce qu'un navigateur PEUT faire :
 *  - bloquer copier / couper / coller / glisser-déposer / clic droit / sélection du texte ;
 *  - bloquer les raccourcis (Ctrl/Cmd + C, V, X, A, P, S, U, F12…) ;
 *  - détecter la touche « Impr. écran » sur PC et vider le presse-papiers ;
 *  - détecter quand l'élève quitte l'onglet / l'application (pour aller voir une IA)
 *    et masquer les questions pendant ce temps ;
 *  - tout enregistrer pour l'enseignant.
 *
 * Ce qu'AUCUN site web ne peut faire : empêcher une capture d'écran faite par le
 * système (boutons de la tablette / du téléphone, Win+Maj+S…) ou une photo prise
 * avec un autre téléphone. D'où le filigrane nominatif affiché sur les questions.
 */

export type CheatEventType =
  | "copy"
  | "cut"
  | "paste"
  | "drop"
  | "context_menu"
  | "shortcut"
  | "screenshot_key"
  | "print"
  | "left_quiz";

export interface CheatEvent {
  type: CheatEventType;
  at: string; // ISO
  detail?: string;
}

interface Options {
  active: boolean;
  /** Nombre de sorties autorisées avant envoi automatique (0 = jamais d'envoi automatique). */
  maxFocusLosses: number;
  onBlocked: (type: CheatEventType) => void;
  onFocusLoss: (count: number) => void;
  onLimitReached: () => void;
}

/** Sorties plus courtes que ce délai : pas comptées (bannière de notification, etc.). */
const AWAY_GRACE_MS = 1500;

export function useQuizAntiCheat({ active, maxFocusLosses, onBlocked, onFocusLoss, onLimitReached }: Options) {
  const [isAway, setIsAway] = useState(false);
  const [focusLosses, setFocusLosses] = useState(0);
  const [warningOpen, setWarningOpen] = useState(false);
  const eventsRef = useRef<CheatEvent[]>([]);
  const awaySinceRef = useRef<number | null>(null);
  const lossesRef = useRef(0);

  // Callbacks toujours à jour sans réinstaller les écouteurs
  const cbRef = useRef({ onBlocked, onFocusLoss, onLimitReached, maxFocusLosses });
  cbRef.current = { onBlocked, onFocusLoss, onLimitReached, maxFocusLosses };

  const record = useCallback((type: CheatEventType, detail?: string) => {
    const list = eventsRef.current;
    if (list.length < 200) list.push({ type, at: new Date().toISOString(), detail });
  }, []);

  const reset = useCallback(() => {
    eventsRef.current = [];
    lossesRef.current = 0;
    awaySinceRef.current = null;
    setFocusLosses(0);
    setIsAway(false);
    setWarningOpen(false);
  }, []);

  useEffect(() => {
    if (!active) return;

    const isEditable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
    };

    const block = (type: CheatEventType) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (type === "copy" || type === "cut") {
        try {
          (e as ClipboardEvent).clipboardData?.setData("text/plain", "");
        } catch { /* ignore */ }
      }
      record(type);
      cbRef.current.onBlocked(type);
    };

    const onCopy = block("copy");
    const onCut = block("cut");
    const onPaste = block("paste");
    const onDrop = block("drop");
    const onContext = block("context_menu");
    const onDragStart = (e: Event) => e.preventDefault();
    // Sélection interdite hors des zones de saisie (le curseur doit rester utilisable dans la réponse)
    const onSelectStart = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };
    // Coller via le menu iOS / Android ou le presse-papiers du clavier
    const onBeforeInput = (e: Event) => {
      const it = (e as InputEvent).inputType || "";
      if (it === "insertFromPaste" || it === "insertFromDrop" || it === "insertFromYank" || it === "insertFromPasteAsQuotation") {
        e.preventDefault();
        record("paste", it);
        cbRef.current.onBlocked("paste");
      }
    };

    const clearClipboard = () => {
      try {
        const nav = navigator as any;
        if (nav.clipboard && nav.clipboard.writeText) nav.clipboard.writeText("").catch(() => undefined);
      } catch { /* ignore */ }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const forbiddenWithMod = ["c", "x", "v", "a", "p", "s", "u", "insert"];
      const devtools = key === "f12" || (mod && e.shiftKey && ["i", "j", "c", "s"].includes(key));
      const shiftInsert = e.shiftKey && key === "insert"; // coller sous Windows
      if ((mod && forbiddenWithMod.includes(key)) || devtools || shiftInsert) {
        e.preventDefault();
        e.stopPropagation();
        const type: CheatEventType = key === "p" ? "print" : "shortcut";
        record(type, `${mod ? (e.metaKey ? "Cmd+" : "Ctrl+") : ""}${e.shiftKey ? "Maj+" : ""}${e.key}`);
        cbRef.current.onBlocked(type);
      }
      if (key === "printscreen") {
        clearClipboard();
      }
    };
    // Windows n'envoie souvent que keyup pour « Impr. écran »
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key || "").toLowerCase() === "printscreen") {
        clearClipboard();
        record("screenshot_key");
        cbRef.current.onBlocked("screenshot_key");
      }
    };

    const onBeforePrint = () => {
      record("print");
      cbRef.current.onBlocked("print");
    };

    /* ----- Sortie de l'onglet / de l'application ----- */
    const goAway = () => {
      if (awaySinceRef.current !== null) return;
      awaySinceRef.current = Date.now();
      setIsAway(true);
    };
    const comeBack = () => {
      if (awaySinceRef.current === null) return;
      if (document.visibilityState === "hidden") return;
      const duration = Date.now() - awaySinceRef.current;
      awaySinceRef.current = null;
      setIsAway(false);
      if (duration < AWAY_GRACE_MS) return;
      lossesRef.current += 1;
      const n = lossesRef.current;
      record("left_quiz", `${Math.round(duration / 1000)} s`);
      setFocusLosses(n);
      const { maxFocusLosses: max } = cbRef.current;
      if (max > 0 && n >= max) {
        cbRef.current.onLimitReached();
      } else {
        setWarningOpen(true);
        cbRef.current.onFocusLoss(n);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") goAway();
      else comeBack();
    };
    const onBlur = () => goAway();
    const onFocus = () => comeBack();
    // iOS : en revenant d'une autre app, "focus" n'est pas toujours émis
    const onPageShow = () => comeBack();

    const opts = true; // phase de capture : passe avant les autres gestionnaires
    document.addEventListener("copy", onCopy, opts);
    document.addEventListener("cut", onCut, opts);
    document.addEventListener("paste", onPaste, opts);
    document.addEventListener("drop", onDrop, opts);
    document.addEventListener("dragstart", onDragStart, opts);
    document.addEventListener("contextmenu", onContext, opts);
    document.addEventListener("selectstart", onSelectStart, opts);
    document.addEventListener("beforeinput", onBeforeInput, opts);
    document.addEventListener("keydown", onKeyDown, opts);
    document.addEventListener("keyup", onKeyUp, opts);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("beforeprint", onBeforePrint);

    // Désélectionne tout texte déjà sélectionné
    try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }

    return () => {
      document.removeEventListener("copy", onCopy, opts);
      document.removeEventListener("cut", onCut, opts);
      document.removeEventListener("paste", onPaste, opts);
      document.removeEventListener("drop", onDrop, opts);
      document.removeEventListener("dragstart", onDragStart, opts);
      document.removeEventListener("contextmenu", onContext, opts);
      document.removeEventListener("selectstart", onSelectStart, opts);
      document.removeEventListener("beforeinput", onBeforeInput, opts);
      document.removeEventListener("keydown", onKeyDown, opts);
      document.removeEventListener("keyup", onKeyUp, opts);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("beforeprint", onBeforePrint);
      awaySinceRef.current = null;
      setIsAway(false);
    };
  }, [active, record]);

  return {
    isAway,
    focusLosses,
    warningOpen,
    closeWarning: () => setWarningOpen(false),
    getEvents: () => eventsRef.current.slice(),
    /** Saisie anormalement longue d'un coup (presse-papiers du clavier Android, etc.) */
    recordSuspiciousInput: (detail: string) => {
      record("paste", detail);
      cbRef.current.onBlocked("paste");
    },
    reset,
  };
}
