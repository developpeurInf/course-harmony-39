import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Affiche le rapport A4 (210 mm ≈ 794 px) réduit pour tenir dans la largeur de l'écran
 * (téléphones, iPad, petits PC) sans défilement horizontal.
 * - `fit=false` ou `disabled=true` (export PDF / impression) : taille réelle, aucune transformation.
 * - Compatible iOS 12 : ResizeObserver utilisé seulement s'il existe, sinon resize/orientationchange.
 */
const A4_WIDTH_PX = 794;
const SIDE_PADDING = 48; // marge de la zone grise autour des pages

export default function ReportScaler({
  children,
  fit = true,
  disabled = false,
}: {
  children: ReactNode;
  fit?: boolean;
  disabled?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const active = fit && !disabled;
  const naturalWidth = A4_WIDTH_PX + SIDE_PADDING;

  const measure = () => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const available = outer.clientWidth;
    const s = active ? Math.min(1, available / naturalWidth) : 1;
    setScale(prev => (Math.abs(prev - s) > 0.001 ? s : prev));
    const h = inner.offsetHeight * s;
    setHeight(prev => (prev === undefined || Math.abs(prev - h) > 1 ? h : prev));
  };

  useLayoutEffect(measure);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    let ro: any = null;
    const RO = (window as any).ResizeObserver;
    if (RO) {
      ro = new RO(() => measure());
      if (outerRef.current) ro.observe(outerRef.current);
      if (innerRef.current) ro.observe(innerRef.current);
    }
    // Graphiques et polices chargés après coup : quelques mesures de rattrapage
    const timers = [150, 500, 1200].map(ms => window.setTimeout(measure, ms));
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (ro) ro.disconnect();
      timers.forEach(t => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) {
    return (
      <div ref={outerRef} className="report-scaler w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" } as any}>
        <div ref={innerRef} className="report-scaler-inner" style={{ minWidth: naturalWidth }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      className="report-scaler w-full overflow-hidden"
      style={{ height: scale < 1 && height ? height : undefined, direction: "ltr" }}
    >
      <div
        ref={innerRef}
        className="report-scaler-inner"
        style={
          scale < 1
            ? { width: naturalWidth, transform: `scale(${scale})`, WebkitTransform: `scale(${scale})`, transformOrigin: "0 0", WebkitTransformOrigin: "0 0" } as any
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
