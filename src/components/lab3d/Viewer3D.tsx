/**
 * Visionneuse du Labo 3D : rotation à la souris / au doigt, plein écran,
 * réalité augmentée (WebXR + détection de surface sur Android, Quick Look sur iPhone / iPad),
 * réalité virtuelle (casque WebXR) et mode carton (écran partagé + gyroscope).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { StereoEffect } from "three/examples/jsm/effects/StereoEffect.js";
import { Box, Glasses, Loader2, Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw, RotateCw, SkipBack, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildScene, type BuiltScene } from "@/lib/lab3d/buildScene";
import { normalizeParams, type Params, type Tri } from "@/lib/lab3d/templates";
import { requestOrientationPermission, useXrSupport } from "@/lib/lab3d/features";
import { cn } from "@/lib/utils";

type Mode = "3d" | "ar" | "vr" | "cardboard";

const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

/** Quaternion de l'appareil à partir des angles du gyroscope (convention W3C) */
const zee = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
function deviceQuaternion(out: THREE.Quaternion, alpha: number, beta: number, gamma: number, orient: number) {
  const e = new THREE.Euler(THREE.MathUtils.degToRad(beta), THREE.MathUtils.degToRad(alpha), -THREE.MathUtils.degToRad(gamma), "YXZ");
  out.setFromEuler(e);
  out.multiply(q1);
  out.multiply(new THREE.Quaternion().setFromAxisAngle(zee, -THREE.MathUtils.degToRad(orient)));
  return out;
}

export function Viewer3D({ template, params, ar = true, vr = true, height = 440, className, onInfo }: {
  template: string;
  params: Params;
  ar?: boolean;
  vr?: boolean;
  height?: number | string;
  className?: string;
  onInfo?: (b: BuiltScene) => void;
}) {
  const { language } = useLanguage();
  const tr = (fr: string, a: string, en: string) => (language === "ar" ? a : language === "en" ? en : fr);
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const support = useXrSupport();

  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    holder: THREE.Group; reticle: THREE.Mesh; stereo: StereoEffect | null; built: BuiltScene | null;
    size: THREE.Vector3; hitSource: any; placed: boolean; mode: Mode; orient: { a: number; b: number; g: number; a0: number | null };
    sim: { t: number; last: number; playing: boolean; speed: number };
  } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const [mode, setMode] = useState<Mode>("3d");
  const [fullscreen, setFullscreen] = useState(false);
  const [built, setBuilt] = useState<BuiltScene | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const prm = useMemo(() => normalizeParams(template, params), [template, params]);

  // --- initialisation three.js -------------------------------------------------
  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark() ? 0x0f1220 : 0xf4f6fb);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(5, 10, 7);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
    camera.position.set(8, 6, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const holder = new THREE.Group();
    scene.add(holder);

    const ring = new THREE.RingGeometry(0.06, 0.08, 40).rotateX(-Math.PI / 2);
    const reticle = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0x4dabf7 }));
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    const c = ctx.current = {
      renderer, scene, camera, controls, holder, reticle, stereo: null, built: null,
      size: new THREE.Vector3(4, 4, 4), hitSource: null, placed: false, mode: "3d" as Mode,
      orient: { a: 0, b: 90, g: 0, a0: null as number | null },
      sim: { t: 0, last: performance.now(), playing: true, speed: 1 },
    };

    const resize = () => {
      const w = host.clientWidth || 300, h = host.clientHeight || 300;
      if (renderer.xr.isPresenting) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      c.stereo?.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const tmpQ = new THREE.Quaternion();
    renderer.setAnimationLoop((_t: number, frame: any) => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - c.sim.last) / 1000);
      c.sim.last = now;
      if (c.built?.update) {
        if (c.sim.playing) c.sim.t += dt * c.sim.speed;
        c.built.update(c.sim.t);
      }
      if (c.mode === "ar" && frame && c.hitSource && !c.placed) {
        const ref = renderer.xr.getReferenceSpace();
        const hits = frame.getHitTestResults(c.hitSource);
        if (hits.length && ref) {
          const pose = hits[0].getPose(ref);
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        } else reticle.visible = false;
      }
      if (c.mode === "cardboard") {
        const o = c.orient;
        const orient = (screen.orientation?.angle ?? (window as any).orientation ?? 0) as number;
        deviceQuaternion(tmpQ, o.a - (o.a0 ?? o.a), o.b, o.g, orient);
        camera.quaternion.copy(tmpQ);
        c.stereo!.render(scene, camera);
        return;
      }
      if (!renderer.xr.isPresenting) controls.update();
      renderer.render(scene, camera);
    });

    // thème clair / sombre
    const mo = new MutationObserver(() => {
      if (c.mode === "ar") return;
      scene.background = new THREE.Color(isDark() ? 0x0f1220 : 0xf4f6fb);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      ro.disconnect();
      mo.disconnect();
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end().catch(() => {});
      c.built?.dispose();
      controls.dispose();
      ring.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
    };
  }, []);

  // --- (re)construction de la scène --------------------------------------------
  const firstFit = useRef(true);
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.built?.dispose();
    c.holder.clear();
    const b = buildScene(template, prm, isDark());
    // poser l'objet sur le plan (base à y = 0, centré en x / z)
    const box = new THREE.Box3().setFromObject(b.root);
    if (!box.isEmpty()) {
      const ctr = box.getCenter(new THREE.Vector3());
      b.root.position.set(-ctr.x, -box.min.y, -ctr.z);
      c.size = box.getSize(new THREE.Vector3());
    }
    c.holder.add(b.root);
    c.sim.t = 0;
    c.built = b;
    setBuilt(b);
    onInfo?.(b);
    if (firstFit.current) { firstFit.current = false; fit(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, prm]);

  const fit = useCallback(() => {
    const c = ctx.current;
    if (!c) return;
    const r = Math.max(c.size.x, c.size.y, c.size.z, 1);
    c.controls.target.set(0, c.size.y / 2, 0);
    c.camera.position.set(r * 1.25, c.size.y / 2 + r * 0.9, r * 1.7);
    c.camera.near = r / 200;
    c.camera.far = r * 60;
    c.camera.updateProjectionMatrix();
    c.controls.update();
  }, []);
  useEffect(() => { fit(); }, [template, fit]);

  // --- plein écran ---------------------------------------------------------------
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current?.requestFullscreen();
    } catch { /* navigateur sans plein écran */ }
  };

  const resetHolder = () => {
    const c = ctx.current!;
    c.holder.position.set(0, 0, 0);
    c.holder.scale.setScalar(1);
    c.holder.rotation.set(0, 0, 0);
    c.holder.visible = true;
    c.reticle.visible = false;
    c.scene.background = new THREE.Color(isDark() ? 0x0f1220 : 0xf4f6fb);
    c.mode = "3d";
    c.hitSource = null;
    c.placed = false;
    setPlaced(false);
    setMode("3d");
  };

  // --- réalité augmentée (WebXR) ----------------------------------------------------
  const startAR = async () => {
    const c = ctx.current;
    if (!c) return;
    setMsg(null);
    if (!support?.ar) {
      if (support?.quickLook) return openQuickLook();
      setMsg(tr(
        "La réalité augmentée demande un téléphone Android récent avec Chrome (ARCore) ou un iPhone / iPad. Ouvrez cette page sur le téléphone.",
        "الواقع المعزز يتطلب هاتف أندرويد حديث مع Chrome (ARCore) أو آيفون / آيباد. افتح هذه الصفحة على الهاتف.",
        "Augmented reality needs a recent Android phone with Chrome (ARCore) or an iPhone / iPad. Open this page on the phone.",
      ));
      return;
    }
    try {
      const session = await (navigator as any).xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "local-floor"],
        domOverlay: { root: overlayRef.current },
      });
      c.renderer.xr.setReferenceSpaceType("local");
      await c.renderer.xr.setSession(session);
      const viewer = await session.requestReferenceSpace("viewer");
      c.hitSource = await session.requestHitTestSource({ space: viewer });
      c.mode = "ar";
      c.placed = false;
      c.scene.background = null;
      // environ 30 cm pour la plus grande dimension
      const s = 0.3 / Math.max(c.size.x, c.size.y, c.size.z, 0.001);
      c.holder.scale.setScalar(s);
      c.holder.visible = false;
      setMode("ar");
      setPlaced(false);
      session.addEventListener("select", () => {
        if (!c.reticle.visible) return;
        c.holder.position.setFromMatrixPosition(c.reticle.matrix);
        c.holder.visible = true;
        c.placed = true;
        c.reticle.visible = false;
        setPlaced(true);
      });
      session.addEventListener("end", resetHolder);
    } catch (e: any) {
      setMsg(tr("Impossible de démarrer la réalité augmentée : ", "تعذر تشغيل الواقع المعزز: ", "Could not start augmented reality: ") + (e?.message || e));
    }
  };
  const arScale = (k: number) => { const c = ctx.current; if (c) c.holder.scale.multiplyScalar(k); };
  const arRotate = (a: number) => { const c = ctx.current; if (c) c.holder.rotation.y += a; };
  const arReplace = () => { const c = ctx.current; if (!c) return; c.placed = false; c.holder.visible = false; setPlaced(false); };
  const endXR = () => { ctx.current?.renderer.xr.getSession()?.end().catch(() => {}); };

  // --- iPhone / iPad : AR Quick Look (export USDZ) ------------------------------------
  const openQuickLook = async () => {
    const c = ctx.current;
    if (!c || !c.built) return;
    setBusy("ar");
    try {
      const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
      const g = new THREE.Group();
      const clone = c.built.root.clone(true);
      g.add(clone);
      g.scale.setScalar(0.3 / Math.max(c.size.x, c.size.y, c.size.z, 0.001));
      g.updateMatrixWorld(true);
      const data = await new USDZExporter().parseAsync(g);
      const url = URL.createObjectURL(new Blob([data as any], { type: "model/vnd.usdz+zip" }));
      const a = document.createElement("a");
      a.rel = "ar";
      a.href = url;
      a.appendChild(document.createElement("img"));
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60_000);
    } catch (e: any) {
      setMsg(tr("Export AR impossible : ", "تعذر التصدير: ", "AR export failed: ") + (e?.message || e));
    } finally { setBusy(null); }
  };

  // --- réalité virtuelle (casque WebXR) -------------------------------------------------
  const startVR = async () => {
    const c = ctx.current;
    if (!c) return;
    setMsg(null);
    if (!support?.vr) return startCardboard();
    try {
      const session = await (navigator as any).xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor"] });
      c.renderer.xr.setReferenceSpaceType("local-floor");
      await c.renderer.xr.setSession(session);
      c.mode = "vr";
      // l'objet tient dans un cube d'environ 1 m, posé sur une table virtuelle devant l'élève
      const s = 1 / Math.max(c.size.x, c.size.y, c.size.z, 0.001);
      c.holder.scale.setScalar(s);
      c.holder.position.set(0, 0.8, -1.4);
      setMode("vr");
      // gâchette : tourner l'objet de 45°
      [0, 1].forEach((i) => c.renderer.xr.getController(i).addEventListener("select", () => { c.holder.rotation.y += Math.PI / 4; }));
      session.addEventListener("end", resetHolder);
    } catch (e: any) {
      setMsg(tr("Impossible de démarrer la réalité virtuelle : ", "تعذر تشغيل الواقع الافتراضي: ", "Could not start virtual reality: ") + (e?.message || e));
    }
  };

  // --- mode carton : écran partagé + gyroscope ---------------------------------------------
  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    const c = ctx.current;
    if (!c || e.alpha === null) return;
    if (c.orient.a0 === null) c.orient.a0 = e.alpha;
    c.orient.a = e.alpha; c.orient.b = e.beta ?? 90; c.orient.g = e.gamma ?? 0;
  }, []);
  const startCardboard = async () => {
    const c = ctx.current;
    if (!c) return;
    if (!support?.gyro) {
      setMsg(tr(
        "Le mode carton fonctionne sur téléphone (gyroscope). Avec un casque (Quest…), ouvrez la page dans son navigateur.",
        "وضع الكرتون يعمل على الهاتف (الجيروسكوب). مع خوذة (Quest…) افتح الصفحة في متصفحها.",
        "Cardboard mode works on a phone (gyroscope). With a headset (Quest…), open the page in its browser.",
      ));
      return;
    }
    if (!(await requestOrientationPermission())) {
      setMsg(tr("Autorisez l'accès aux capteurs de mouvement.", "اسمح بالوصول إلى مستشعرات الحركة.", "Allow access to motion sensors."));
      return;
    }
    c.stereo = c.stereo || new StereoEffect(c.renderer);
    c.stereo.setEyeSeparation(Math.max(c.size.x, c.size.y, c.size.z) * 0.012);
    c.orient.a0 = null;
    window.addEventListener("deviceorientation", onOrient);
    const r = Math.max(c.size.x, c.size.y, c.size.z, 1);
    c.camera.position.set(0, c.size.y / 2, r * 2.2);
    c.mode = "cardboard";
    setMode("cardboard");
    try {
      await wrapRef.current?.requestFullscreen();
      await (screen.orientation as any)?.lock?.("landscape");
    } catch { /* facultatif */ }
    const host = hostRef.current!;
    c.stereo.setSize(host.clientWidth, host.clientHeight);
  };
  const stopCardboard = async () => {
    const c = ctx.current;
    window.removeEventListener("deviceorientation", onOrient);
    try { (screen.orientation as any)?.unlock?.(); if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* */ }
    if (c) {
      c.mode = "3d";
      const host = hostRef.current!;
      c.renderer.setSize(host.clientWidth, host.clientHeight, false);
      c.renderer.setScissorTest(false);
      c.renderer.setViewport(0, 0, host.clientWidth, host.clientHeight);
      fit();
    }
    setMode("3d");
  };
  useEffect(() => () => window.removeEventListener("deviceorientation", onOrient), [onOrient]);
  // un toucher sur les boutons de la surcouche AR ne doit pas poser l'objet
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const stop = (e: Event) => { if ((e.target as HTMLElement)?.closest("button")) e.preventDefault(); };
    el.addEventListener("beforexrselect", stop);
    return () => el.removeEventListener("beforexrselect", stop);
  }, []);

  const arLabel = support?.ar ? tr("Voir en AR", "عرض بالواقع المعزز", "View in AR")
    : support?.quickLook ? tr("Voir en AR (iPhone)", "عرض بالواقع المعزز", "View in AR (iPhone)")
    : tr("Réalité augmentée", "الواقع المعزز", "Augmented reality");
  const vrLabel = support?.vr ? tr("Casque VR", "خوذة الواقع الافتراضي", "VR headset") : tr("Mode carton VR", "وضع الكرتون", "Cardboard VR");

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={wrapRef} className={cn("relative overflow-hidden rounded-xl border bg-muted", fullscreen && "rounded-none border-0")} style={{ height: fullscreen ? "100vh" : height }}>
        <div ref={hostRef} className="absolute inset-0" />
        {built?.error && <div className="absolute inset-x-3 top-3 rounded-lg bg-destructive/90 px-3 py-2 text-xs text-destructive-foreground">{built.error}</div>}

        {mode === "3d" && (
          <div className="absolute end-2 top-2 flex gap-1">
            <Button size="icon" variant="secondary" className="h-8 w-8 opacity-90" title={tr("Recentrer", "إعادة التوسيط", "Recenter")} onClick={fit}><RotateCcw className="h-4 w-4" /></Button>
            <Button size="icon" variant="secondary" className="h-8 w-8 opacity-90" title={tr("Plein écran", "ملء الشاشة", "Fullscreen")} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
          </div>
        )}
        {built?.update && mode !== "cardboard" && (
          <div className="absolute bottom-2 end-2 flex items-center gap-1 rounded-lg bg-background/80 p-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" title={playing ? tr("Pause", "إيقاف مؤقت", "Pause") : tr("Lecture", "تشغيل", "Play")} onClick={() => { const c = ctx.current; if (!c) return; c.sim.playing = !c.sim.playing; setPlaying(c.sim.playing); }}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title={tr("Recommencer", "إعادة", "Restart")} onClick={() => { const c = ctx.current; if (c) c.sim.t = 0; }}><SkipBack className="h-4 w-4" /></Button>
            {[0.25, 0.5, 1, 2].map((s) => (
              <button key={s} className={cn("rounded px-1.5 py-0.5 text-[11px] tabular-nums", speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} onClick={() => { const c = ctx.current; if (c) c.sim.speed = s; setSpeed(s); }}>×{String(s).replace(".", ",")}</button>
            ))}
          </div>
        )}
        {mode === "3d" && (
          <p className="pointer-events-none absolute bottom-2 start-2 rounded bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground">
            {tr("Glisser pour tourner · molette / pincer pour zoomer", "اسحب للتدوير · اقرص للتكبير", "Drag to rotate · scroll / pinch to zoom")}
          </p>
        )}
        {mode === "cardboard" && (
          <Button size="sm" variant="secondary" className="absolute start-1/2 top-2 -translate-x-1/2 opacity-80" onClick={stopCardboard}><X className="me-1 h-4 w-4" />{tr("Quitter", "خروج", "Exit")}</Button>
        )}

        {/* surcouche affichée pendant la session AR (dom-overlay) */}
        <div ref={overlayRef} className={cn("pointer-events-none absolute inset-0", mode !== "ar" && "hidden")}>
          <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {placed ? tr("Tournez autour de l'objet", "تجول حول المجسم", "Walk around the object") : tr("Visez une table ou le sol, puis touchez l'écran", "صوب نحو طاولة أو الأرض ثم المس الشاشة", "Aim at a table or the floor, then tap")}
            </span>
            <button className="rounded-full bg-black/60 p-2 text-white" onClick={endXR}><X className="h-5 w-5" /></button>
          </div>
          {placed && (
            <div className="pointer-events-auto absolute inset-x-0 bottom-6 flex justify-center gap-2">
              {[
                { i: <RotateCcw className="h-5 w-5" />, f: () => arRotate(-Math.PI / 8) },
                { i: <RotateCw className="h-5 w-5" />, f: () => arRotate(Math.PI / 8) },
                { i: <Minus className="h-5 w-5" />, f: () => arScale(1 / 1.25) },
                { i: <Plus className="h-5 w-5" />, f: () => arScale(1.25) },
              ].map((b, k) => <button key={k} className="rounded-full bg-black/60 p-3 text-white" onClick={(e) => { e.stopPropagation(); b.f(); }}>{b.i}</button>)}
              <button className="rounded-full bg-black/60 px-4 text-sm text-white" onClick={(e) => { e.stopPropagation(); arReplace(); }}>{tr("Déplacer", "تحريك", "Move")}</button>
            </div>
          )}
        </div>
      </div>

      {mode === "3d" && (ar || vr) && (
        <div className="flex flex-wrap gap-2">
          {ar && (
            <Button size="sm" variant="outline" onClick={startAR} disabled={!support || busy === "ar"}>
              {busy === "ar" ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Smartphone className="me-1.5 h-4 w-4" />}{arLabel}
            </Button>
          )}
          {vr && (
            <Button size="sm" variant="outline" onClick={startVR} disabled={!support}>
              <Glasses className="me-1.5 h-4 w-4" />{vrLabel}
            </Button>
          )}
          {vr && support?.vr && support.gyro && (
            <Button size="sm" variant="ghost" onClick={startCardboard}><Box className="me-1.5 h-4 w-4" />{tr("Mode carton", "وضع الكرتون", "Cardboard")}</Button>
          )}
        </div>
      )}
      {msg && <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">{msg}</p>}
      {built && built.info.length > 0 && mode === "3d" && (
        <div className="grid gap-1.5 rounded-xl border bg-card p-3 text-xs sm:grid-cols-2">
          {built.info.map((l, i) => (
            <div key={i} className="flex flex-col"><span className="text-muted-foreground">{L(l.label)}</span><span className="font-medium tabular-nums">{l.value}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
