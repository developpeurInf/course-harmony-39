/**
 * Outils de mesure du Labo 3D :
 *  - mètre AR (WebXR, détection de surface) : distances entre points touchés ;
 *  - clinomètre (caméra + gyroscope) : hauteur d'un bâtiment par la trigonométrie ;
 *  - méthode de l'ombre (Thalès).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Camera, Lock, Ruler, Sun, Triangle, Undo2, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/lib/router";
import { useLanguage } from "@/contexts/LanguageContext";
import { requestOrientationPermission, useXrSupport } from "@/lib/lab3d/features";
import { cn } from "@/lib/utils";

const num = (s: string) => Number(String(s).replace(",", "."));

export default function Lab3DMeasure() {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const fmt = (n: number, d = 2) => (Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d).replace(".", language === "en" ? "." : ",") : "—");
  const [tab, setTab] = useState<"ruler" | "clino" | "shadow">("clino");
  const support = useXrSupport();

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Ruler className="h-6 w-6 text-muted-foreground" />{tr("Mesurer le réel", "القياس في الواقع", "Measure the real world")}</h1>
        <Button asChild variant="outline" size="sm"><Link to="/lab3d">{tr("← Labo 3D", "← المختبر ثلاثي الأبعاد", "← 3D Lab")}</Link></Button>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {tr(
          "Sortez de la classe : mesurez une table, la cour, la hauteur d'un arbre ou du lycée, puis vérifiez par le calcul (trigonométrie, Thalès).",
          "اخرج من القسم: قس طاولة أو الساحة أو ارتفاع شجرة أو الثانوية ثم تحقق بالحساب (حساب المثلثات، طاليس).",
          "Step outside: measure a table, the playground, the height of a tree or of the school, then check by calculation (trigonometry, Thales).",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {([
          ["clino", <Triangle key="i" className="me-1.5 h-4 w-4" />, tr("Clinomètre (hauteur)", "مقياس الميل (الارتفاع)", "Clinometer (height)")],
          ["ruler", <Ruler key="i" className="me-1.5 h-4 w-4" />, tr("Mètre AR (distances)", "متر الواقع المعزز", "AR ruler (distances)")],
          ["shadow", <Sun key="i" className="me-1.5 h-4 w-4" />, tr("Méthode de l'ombre (Thalès)", "طريقة الظل (طاليس)", "Shadow method (Thales)")],
        ] as const).map(([k, icon, label]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{icon}{label}</Button>
        ))}
      </div>
      {tab === "clino" && <Clinometer tr={tr} fmt={fmt} />}
      {tab === "ruler" && <ArRuler tr={tr} fmt={fmt} supported={support?.ar ?? null} />}
      {tab === "shadow" && <Shadow tr={tr} fmt={fmt} />}
    </div>
  );
}

type Tr = (fr: string, ar: string, en: string) => string;
type Fmt = (n: number, d?: number) => string;

// ---------------------------------------------------------------------------------
function Clinometer({ tr, fmt }: { tr: Tr; fmt: Fmt }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [angle, setAngle] = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const [d, setD] = useState("20");
  const [eye, setEye] = useState("1,5");
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => {
    if (!on) return;
    const h = (e: DeviceOrientationEvent) => {
      if (e.beta === null) return;
      // téléphone tenu debout, caméra vers l'objet : beta = 90° à l'horizontale
      setAngle(Math.max(-89, Math.min(89, e.beta - 90)));
    };
    window.addEventListener("deviceorientation", h);
    return () => window.removeEventListener("deviceorientation", h);
  }, [on]);

  const start = async () => {
    setErr(null);
    if (!(await requestOrientationPermission())) { setErr(tr("Autorisez les capteurs de mouvement.", "اسمح بمستشعرات الحركة.", "Allow motion sensors.")); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
    } catch {
      setErr(tr("Caméra indisponible : le viseur reste vide, l'angle fonctionne quand même.", "الكاميرا غير متاحة: الزاوية تعمل رغم ذلك.", "Camera unavailable: the angle still works."));
    }
    setOn(true);
  };
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setOn(false); };

  const alpha = locked ?? (manual ? num(manual) : angle);
  const H = alpha === null ? NaN : num(d) * Math.tan((alpha * Math.PI) / 180) + num(eye);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative aspect-[3/4] max-h-[70vh] overflow-hidden rounded-xl border bg-black sm:aspect-video">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {!on && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <Camera className="h-10 w-10 opacity-70" />
            <p className="text-sm opacity-80">{tr("Tenez le téléphone debout, visez le sommet de l'objet avec la croix.", "أمسك الهاتف عموديا وصوب نحو قمة المجسم.", "Hold the phone upright and aim the cross at the top of the object.")}</p>
            <Button onClick={start}>{tr("Démarrer le viseur", "تشغيل المنظار", "Start the viewfinder")}</Button>
          </div>
        )}
        {on && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-24 w-24"><div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-red-500" /><div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-red-500" /></div>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
              <span className="text-2xl font-semibold tabular-nums">α = {fmt(locked ?? angle ?? NaN, 1)}°</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setLocked(locked === null ? angle : null)}>
                  {locked === null ? <><Lock className="me-1 h-4 w-4" />{tr("Figer", "تثبيت", "Lock")}</> : <><Unlock className="me-1 h-4 w-4" />{tr("Reprendre", "استئناف", "Resume")}</>}
                </Button>
                <Button size="icon" variant="secondary" onClick={stop}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{tr("Calcul de la hauteur", "حساب الارتفاع", "Height calculation")}</h2>
        <div className="space-y-1.5"><Label className="text-xs">{tr("Distance jusqu'au pied de l'objet d (m)", "المسافة إلى قاعدة المجسم d (م)", "Distance to the foot d (m)")}</Label><Input inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{tr("Hauteur des yeux (m)", "ارتفاع العينين (م)", "Eye height (m)")}</Label><Input inputMode="decimal" value={eye} onChange={(e) => setEye(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{tr("Angle saisi à la main (facultatif, °)", "الزاوية يدويا (اختياري)", "Angle typed by hand (optional, °)")}</Label><Input inputMode="decimal" placeholder={tr("sinon : angle du capteur", "وإلا: زاوية المستشعر", "otherwise: sensor angle")} value={manual} onChange={(e) => setManual(e.target.value)} disabled={locked !== null} /></div>
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="font-mono text-xs text-muted-foreground">H = d × tan(α) + {tr("yeux", "العينان", "eyes")}</p>
          <p className="mt-1 font-mono text-xs">= {fmt(num(d))} × tan({fmt(alpha ?? NaN, 1)}°) + {fmt(num(eye))}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">H ≈ {fmt(H)} m</p>
        </div>
        {err && <p className="text-xs text-amber-600">{err}</p>}
        <p className="text-[11px] text-muted-foreground">{tr("Astuce : mesurez d avec le mètre AR ou en comptant vos pas (1 pas ≈ 0,7 m).", "نصيحة: قس d بمتر الواقع المعزز أو بعد خطواتك (خطوة ≈ 0,7 م).", "Tip: measure d with the AR ruler or by counting steps (1 step ≈ 0.7 m).")}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
function ArRuler({ tr, fmt, supported }: { tr: Tr; fmt: Fmt; supported: boolean | null }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [segs, setSegs] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const undoRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const stop = (e: Event) => { if ((e.target as HTMLElement)?.closest("button")) e.preventDefault(); };
    el.addEventListener("beforexrselect", stop);
    return () => el.removeEventListener("beforexrselect", stop);
  }, []);

  const start = async () => {
    setErr(null);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.xr.enabled = true;
    hostRef.current!.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2));
    const camera = new THREE.PerspectiveCamera();
    const reticle = new THREE.Mesh(new THREE.RingGeometry(0.015, 0.022, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    const dotGeo = new THREE.SphereGeometry(0.008, 12, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xfab005 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xfab005 });
    const points: THREE.Vector3[] = [];
    const objects: THREE.Object3D[][] = [];
    let start: THREE.Vector3 | null = null;
    let rubber: THREE.Line | null = null;
    let hitSource: any = null;

    let session: any;
    try {
      session = await (navigator as any).xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test"], optionalFeatures: ["dom-overlay"], domOverlay: { root: overlayRef.current } });
    } catch (e: any) {
      renderer.dispose(); renderer.domElement.remove();
      setErr(tr("Impossible de démarrer : ", "تعذر التشغيل: ", "Could not start: ") + (e?.message || e));
      return;
    }
    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(session);
    hitSource = await session.requestHitTestSource({ space: await session.requestReferenceSpace("viewer") });
    setActive(true);
    setSegs([]);

    session.addEventListener("select", () => {
      if (!reticle.visible) return;
      const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(p);
      scene.add(dot);
      if (!start) { start = p; points.push(p); objects.push([dot]); setPending(true); return; }
      const g = new THREE.BufferGeometry().setFromPoints([start, p]);
      const line = new THREE.Line(g, lineMat);
      scene.add(line);
      objects.push([dot, line]);
      setSegs((s) => [...s, start!.distanceTo(p)]);
      if (rubber) { scene.remove(rubber); rubber.geometry.dispose(); rubber = null; }
      start = null;
      setPending(false);
    });
    undoRef.current = () => {
      const last = objects.pop();
      if (!last) return;
      last.forEach((o) => scene.remove(o));
      if (last.length === 1) { start = null; setPending(false); points.pop(); } // premier point d'un segment
      else setSegs((s) => s.slice(0, -1));
    };
    stopRef.current = () => session.end().catch(() => {});
    session.addEventListener("end", () => {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
      setActive(false);
      setPending(false);
    });
    renderer.setAnimationLoop((_t: number, frame: any) => {
      if (frame && hitSource) {
        const ref = renderer.xr.getReferenceSpace();
        const hits = frame.getHitTestResults(hitSource);
        if (hits.length && ref) {
          reticle.visible = true;
          reticle.matrix.fromArray(hits[0].getPose(ref).transform.matrix);
          if (start) {
            const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
            if (!rubber) { rubber = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, p]), lineMat); scene.add(rubber); }
            else rubber.geometry.setFromPoints([start, p]);
            const el = overlayRef.current?.querySelector("[data-live]");
            if (el) el.textContent = `${fmt(start.distanceTo(p) * 100, 1)} cm`;
          }
        } else reticle.visible = false;
      }
      renderer.render(scene, camera);
    });
  };

  const total = segs.reduce((s, x) => s + x, 0);
  return (
    <div className="space-y-3">
      <div ref={hostRef} className="hidden" />
      <div ref={overlayRef} className={cn("pointer-events-none fixed inset-0 z-50", !active && "hidden")}>
        <div className="pointer-events-auto flex items-center justify-between gap-2 p-3">
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {pending ? tr("Touchez le 2e point", "المس النقطة الثانية", "Tap the 2nd point") : tr("Visez une surface, touchez le 1er point", "صوب نحو سطح والمس النقطة الأولى", "Aim at a surface, tap the 1st point")}
          </span>
          <div className="flex gap-2">
            <button className="rounded-full bg-black/60 p-2 text-white" onClick={() => undoRef.current()}><Undo2 className="h-5 w-5" /></button>
            <button className="rounded-full bg-black/60 p-2 text-white" onClick={() => stopRef.current()}><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 text-white">
          {pending && <span data-live className="rounded-full bg-amber-500 px-4 py-1 text-lg font-semibold tabular-nums" />}
          {segs.length > 0 && <span className="rounded-full bg-black/60 px-3 py-1 text-sm tabular-nums">{segs.map((s) => `${fmt(s * 100, 1)} cm`).join(" + ")}{segs.length > 1 ? ` = ${fmt(total * 100, 1)} cm` : ""}</span>}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {tr(
            "Visez le sol ou une table, touchez un premier point puis un second : la distance s'affiche. Plusieurs segments s'additionnent (périmètre d'une table, longueur de la classe…).",
            "صوب نحو الأرض أو طاولة، المس نقطة أولى ثم ثانية: تظهر المسافة. تجمع عدة قطع (محيط طاولة، طول القسم…).",
            "Aim at the floor or a table, tap a first point then a second: the distance appears. Several segments add up (perimeter of a table, length of the classroom…).",
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={start} disabled={supported === false || active}><Ruler className="me-1.5 h-4 w-4" />{tr("Lancer le mètre AR", "تشغيل المتر", "Start the AR ruler")}</Button>
          {supported === false && <span className="text-xs text-amber-600">{tr("Nécessite un téléphone Android avec Chrome (ARCore). Sur iPhone, utilisez l'app « Mesures » d'Apple puis le clinomètre.", "يتطلب هاتف أندرويد مع Chrome (ARCore). على آيفون استعمل تطبيق Mesures.", "Needs an Android phone with Chrome (ARCore). On iPhone, use Apple's Measure app, then the clinometer.")}</span>}
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        {segs.length > 0 && !active && (
          <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">{tr("Dernières mesures", "آخر القياسات", "Last measurements")}</p>
            <p className="tabular-nums">{segs.map((s) => `${fmt(s, 3)} m`).join(" · ")}</p>
            {segs.length > 1 && <p className="tabular-nums font-semibold">{tr("Total", "المجموع", "Total")} : {fmt(total, 3)} m</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
function Shadow({ tr, fmt }: { tr: Tr; fmt: Fmt }) {
  const [h, setH] = useState("1,7");
  const [s, setS] = useState("2,1");
  const [S, setSS] = useState("14");
  const H = (num(h) * num(S)) / num(s);
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div className="rounded-xl border bg-card p-4">
        <svg viewBox="0 0 400 220" className="w-full">
          <line x1="10" y1="200" x2="390" y2="200" stroke="currentColor" strokeOpacity=".4" />
          <rect x="300" y="40" width="30" height="160" fill="#4c6ef5" fillOpacity=".25" stroke="#4c6ef5" />
          <line x1="70" y1="200" x2="70" y2="150" stroke="#e8590c" strokeWidth="4" />
          <line x1="20" y1="200" x2="330" y2="40" stroke="#fab005" strokeDasharray="5 4" />
          <line x1="20" y1="200" x2="70" y2="200" stroke="#212529" strokeWidth="6" strokeOpacity=".6" />
          <line x1="20" y1="205" x2="300" y2="205" stroke="#212529" strokeWidth="2" strokeOpacity=".4" />
          <text x="78" y="175" fontSize="12" fill="#e8590c">h</text>
          <text x="40" y="195" fontSize="12">s</text>
          <text x="150" y="218" fontSize="12">S</text>
          <text x="338" y="125" fontSize="12" fill="#4c6ef5">H ?</text>
        </svg>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            "Au même instant, les rayons du soleil sont parallèles : les triangles sont en configuration de Thalès, donc H / S = h / s.",
            "في نفس اللحظة، أشعة الشمس متوازية: المثلثان في وضعية طاليس، إذن H / S = h / s.",
            "At the same moment the sun's rays are parallel: the triangles are in a Thales configuration, so H / S = h / s.",
          )}
        </p>
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-1.5"><Label className="text-xs">{tr("Taille de l'élève h (m)", "طول التلميذ h (م)", "Student height h (m)")}</Label><Input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{tr("Ombre de l'élève s (m)", "ظل التلميذ s (م)", "Student shadow s (m)")}</Label><Input inputMode="decimal" value={s} onChange={(e) => setS(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{tr("Ombre de l'objet S (m)", "ظل المجسم S (م)", "Object shadow S (m)")}</Label><Input inputMode="decimal" value={S} onChange={(e) => setSS(e.target.value)} /></div>
        <div className="rounded-lg bg-muted p-3">
          <p className="font-mono text-xs text-muted-foreground">H = h × S / s</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">H ≈ {fmt(H)} m</p>
        </div>
      </div>
    </div>
  );
}
