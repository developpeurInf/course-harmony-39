/**
 * Tableau blanc de réunion : modèle de données, opérations synchronisées, historique.
 *
 * Deux calques :
 *  - "board"  : tableau infini (coordonnées du monde, caméra libre)
 *  - "screen" : annotations posées sur l'écran partagé (largeur fixe de 1000 unités = largeur de l'image)
 *
 * Le magasin ne dépend ni de React ni de LiveKit : un "transport" lui est branché (voir useWhiteboard.ts).
 */

export type Layer = "board" | "screen";
export type ShapeKind = "line" | "arrow" | "dline" | "rect" | "ellipse" | "poly" | "diamond";
export type Paper = "blank" | "grid" | "dots" | "lines" | "seyes";
export type BoardTheme = "light" | "slate" | "chalk";

export interface El {
  id: string;
  by: string;
  k: "ink" | "shape" | "text" | "note" | "image";
  /** ink : origine (1er point) ; line/arrow : départ ; autres : coin haut-gauche */
  x: number;
  y: number;
  /** line/arrow : vecteur (peut être négatif) ; autres : taille */
  w: number;
  h: number;
  color: string;
  size: number;
  /** ink : [dx, dy, pression, …] relatifs à l'origine ; poly : [x, y, …] relatifs (0..1) à la boîte */
  pts?: number[];
  /** ink : échelle appliquée aux points (redimensionnement) */
  sc?: number;
  /** ink : épaisseur variable (stylet) */
  pr?: boolean;
  hl?: boolean;
  shape?: ShapeKind;
  fill?: boolean;
  dash?: boolean;
  text?: string;
  src?: string;
  /** encre éphémère : durée de vie en ms (exp est calculé à la réception) */
  ttl?: number;
  exp?: number;
}

export interface WbState {
  open: boolean;
  allow: boolean;
  paper: Paper;
  theme: BoardTheme;
}

export interface View {
  cx: number;
  cy: number;
  vw: number;
  vh: number;
}

export type Op =
  | { o: "add"; l: Layer; els: El[] }
  | { o: "app"; l: Layer; id: string; pts: number[] }
  | { o: "upd"; l: Layer; id: string; p: Partial<El> }
  | { o: "del"; l: Layer; ids: string[] }
  | { o: "clr"; l: Layer }
  | { o: "front"; l: Layer; ids: string[] }
  | { o: "state"; s: WbState }
  | { o: "view"; v: View }
  | { o: "cur"; l: Layer; x: number; y: number; d: boolean }
  | { o: "laser"; l: Layer; pts: number[] }
  | { o: "req" }
  | { o: "snap"; to: string; board: El[]; screen: El[]; s: WbState; v: View | null };

export interface SendOpts {
  /** perte acceptable (curseurs, laser, vue) */
  lossy?: boolean;
  to?: string[];
}

export interface Transport {
  send: (op: Op, opts?: SendOpts) => void;
}

export interface Peer {
  name: string;
  x: number;
  y: number;
  l: Layer;
  t: number;
  down: boolean;
}

export interface LaserTrail {
  l: Layer;
  /** x, y, temps (ms, horloge locale) */
  pts: number[];
  mine?: boolean;
}

export const DEFAULT_STATE: WbState = { open: false, allow: false, paper: "dots", theme: "light" };
export const SCREEN_W = 1000;
export const LASER_MS = 900;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type Inverse = { l: Layer; ops: Op[] };

const MAX_ELS = 5000;
const MAX_PTS = 30000;

/** Nettoyage d'un élément reçu (le réseau n'est pas digne de confiance) */
function clean(e: any, from: string): El | null {
  if (!e || typeof e !== "object" || typeof e.id !== "string" || e.id.length > 40) return null;
  const kinds = ["ink", "shape", "text", "note", "image"];
  if (!kinds.includes(e.k)) return null;
  const num = (v: any, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const out: El = {
    id: e.id,
    by: from || String(e.by || ""),
    k: e.k,
    x: num(e.x),
    y: num(e.y),
    w: num(e.w),
    h: num(e.h),
    color: typeof e.color === "string" && e.color.length < 30 ? e.color : "fg",
    size: Math.min(400, Math.max(0.5, num(e.size, 4))),
  };
  if (Array.isArray(e.pts)) out.pts = e.pts.slice(0, MAX_PTS).map((n: any) => num(n));
  if (e.sc) out.sc = num(e.sc, 1);
  if (e.pr) out.pr = true;
  if (e.hl) out.hl = true;
  if (typeof e.shape === "string") out.shape = e.shape;
  if (e.fill) out.fill = true;
  if (e.dash) out.dash = true;
  if (typeof e.text === "string") out.text = e.text.slice(0, 5000);
  if (typeof e.src === "string" && e.src.startsWith("data:image/")) out.src = e.src;
  if (e.ttl) {
    out.ttl = Math.min(30_000, num(e.ttl));
    out.exp = Date.now() + out.ttl;
  }
  return out;
}

export class WbStore {
  me: string;
  myName: string;
  isHost: boolean;
  docs: Record<Layer, Map<string, El>> = { board: new Map(), screen: new Map() };
  state: WbState = { ...DEFAULT_STATE };
  hostView: View | null = null;
  peers = new Map<string, Peer>();
  lasers = new Map<string, LaserTrail>();
  /** version des documents (redessin) / de l'état (interface) */
  version = 0;
  stateVersion = 0;
  private undoStack: Inverse[] = [];
  private redoStack: Inverse[] = [];
  private listeners = new Set<() => void>();
  private stateListeners = new Set<() => void>();
  private viewListeners = new Set<() => void>();
  transport: Transport = { send: () => undefined };
  /** identifiants des professeurs présents (contrôle des droits à la réception) */
  isHostId: (identity: string) => boolean = () => false;
  nameOf: (identity: string) => string = () => "";

  constructor(me: string, myName: string, isHost: boolean) {
    this.me = me;
    this.myName = myName;
    this.isHost = isHost;
  }

  // -------------------------------------------------------------- abonnements
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  subscribeState = (fn: () => void) => {
    this.stateListeners.add(fn);
    return () => void this.stateListeners.delete(fn);
  };
  subscribeView = (fn: () => void) => {
    this.viewListeners.add(fn);
    return () => void this.viewListeners.delete(fn);
  };
  getVersion = () => this.version;
  getStateVersion = () => this.stateVersion;
  private bump() {
    this.version++;
    this.listeners.forEach(f => f());
  }
  private bumpState() {
    this.stateVersion++;
    this.stateListeners.forEach(f => f());
  }
  /** curseurs / laser : redessin sans toucher aux documents */
  ping() {
    this.listeners.forEach(f => f());
  }

  get canWrite() {
    return this.isHost || this.state.allow;
  }
  canEdit(el: El) {
    return this.isHost || (this.state.allow && el.by === this.me);
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  list(l: Layer) {
    return Array.from(this.docs[l].values());
  }
  get(l: Layer, id: string) {
    return this.docs[l].get(id);
  }
  isEmpty(l: Layer) {
    return this.docs[l].size === 0;
  }

  // -------------------------------------------------------------- application brute
  private applyLocal(op: Op) {
    const d = "l" in op ? this.docs[op.l as Layer] : null;
    switch (op.o) {
      case "add":
        for (const e of op.els) {
          if (d!.size >= MAX_ELS) break;
          d!.delete(e.id);
          d!.set(e.id, e.ttl && !e.exp ? { ...e, exp: Date.now() + e.ttl } : e);
        }
        break;
      case "app": {
        const e = d!.get(op.id);
        if (e && e.pts && e.pts.length < MAX_PTS) d!.set(op.id, { ...e, pts: e.pts.concat(op.pts) });
        break;
      }
      case "upd": {
        const e = d!.get(op.id);
        if (e) d!.set(op.id, { ...e, ...op.p, id: e.id, by: e.by });
        break;
      }
      case "del":
        op.ids.forEach(id => d!.delete(id));
        break;
      case "clr":
        d!.clear();
        break;
      case "front":
        for (const id of op.ids) {
          const e = d!.get(id);
          if (e) {
            d!.delete(id);
            d!.set(id, e);
          }
        }
        break;
    }
  }

  /** Opération reçue d'un autre participant */
  receive(op: Op, from: string) {
    if (!op || typeof op !== "object") return;
    const host = this.isHostId(from);
    const writer = host || this.state.allow;
    const owns = (l: Layer, id: string) => {
      const e = this.docs[l]?.get(id);
      return !e || host || e.by === from;
    };
    const layerOk = (l: any) => l === "board" || l === "screen";
    switch (op.o) {
      case "add": {
        if (!writer || !layerOk(op.l) || !Array.isArray(op.els)) return;
        const els = op.els.map(e => clean(e, from)).filter(Boolean) as El[];
        // un élève ne remplace pas l'élément d'un autre
        this.applyLocal({ o: "add", l: op.l, els: els.filter(e => owns(op.l, e.id)) });
        break;
      }
      case "app":
        if (!writer || !layerOk(op.l) || !Array.isArray(op.pts) || !owns(op.l, op.id)) return;
        this.applyLocal({ o: "app", l: op.l, id: op.id, pts: op.pts.slice(0, 3000).map(Number) });
        break;
      case "upd": {
        if (!writer || !layerOk(op.l) || !owns(op.l, op.id) || !op.p) return;
        const cur = this.docs[op.l].get(op.id);
        if (!cur) return;
        const merged = clean({ ...cur, ...op.p, id: cur.id }, cur.by);
        if (merged) this.docs[op.l].set(op.id, { ...merged, exp: cur.exp });
        break;
      }
      case "del":
        if (!writer || !layerOk(op.l) || !Array.isArray(op.ids)) return;
        this.applyLocal({ o: "del", l: op.l, ids: op.ids.filter(id => owns(op.l, id)) });
        break;
      case "clr":
        if (!host || !layerOk(op.l)) return;
        this.applyLocal(op);
        break;
      case "front":
        if (!writer || !layerOk(op.l) || !Array.isArray(op.ids)) return;
        this.applyLocal(op);
        break;
      case "state":
        if (!host || !op.s) return;
        this.setStateRaw(op.s);
        return;
      case "view":
        if (!host || !op.v) return;
        this.hostView = op.v;
        this.viewListeners.forEach(f => f());
        return;
      case "cur": {
        if (!writer) return;
        this.peers.set(from, { name: this.nameOf(from), x: Number(op.x), y: Number(op.y), l: op.l, t: Date.now(), down: !!op.d });
        this.ping();
        return;
      }
      case "laser": {
        if (!writer || !Array.isArray(op.pts)) return;
        const now = Date.now();
        const trail = this.lasers.get(from) || { l: op.l, pts: [] };
        trail.l = op.l;
        for (let i = 0; i + 1 < op.pts.length; i += 2) trail.pts.push(Number(op.pts[i]), Number(op.pts[i + 1]), now);
        this.lasers.set(from, trail);
        this.ping();
        return;
      }
      case "req":
        return; // traité par le transport (choix du répondant)
      case "snap": {
        if (op.to !== this.me) return;
        // fusion : on garde ce qu'on a déjà, on ajoute le reste
        for (const l of ["board", "screen"] as Layer[]) {
          const els = ((op as any)[l] || []).map((e: any) => clean(e, e?.by)).filter(Boolean) as El[];
          for (const e of els) if (!this.docs[l].has(e.id)) this.docs[l].set(e.id, e);
        }
        if (host && op.s) this.setStateRaw(op.s);
        if (host && op.v) {
          this.hostView = op.v;
          this.viewListeners.forEach(f => f());
        }
        break;
      }
      default:
        return;
    }
    this.bump();
  }

  snapshotFor(to: string): Op {
    const strip = (l: Layer) => this.list(l).filter(e => !e.ttl);
    return { o: "snap", to, board: strip("board"), screen: strip("screen"), s: this.state, v: this.hostView };
  }

  // -------------------------------------------------------------- actions locales
  private commit(op: Op, inverse: Op[] | null, opts?: SendOpts) {
    this.applyLocal(op);
    this.transport.send(op, opts);
    if (inverse && "l" in op) {
      this.undoStack.push({ l: op.l as Layer, ops: inverse });
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = [];
    }
    this.bump();
    this.bumpState();
  }

  add(l: Layer, els: El[], undoable = true) {
    if (!this.canWrite || els.length === 0) return;
    this.commit({ o: "add", l, els }, undoable ? [{ o: "del", l, ids: els.map(e => e.id) }] : null);
  }
  /** début d'un trait (visible en direct par les autres) */
  begin(l: Layer, el: El) {
    if (!this.canWrite) return;
    this.applyLocal({ o: "add", l, els: [{ ...el, pts: el.pts?.slice() }] });
    this.transport.send({ o: "add", l, els: [el] });
    this.bump();
  }
  append(l: Layer, id: string, pts: number[], silent = false) {
    if (!pts.length) return;
    this.applyLocal({ o: "app", l, id, pts });
    this.transport.send({ o: "app", l, id, pts });
    if (!silent) this.bump();
  }
  /** trait abandonné (deuxième doigt posé) */
  abort(l: Layer, id: string) {
    this.applyLocal({ o: "del", l, ids: [id] });
    this.transport.send({ o: "del", l, ids: [id] });
    this.bump();
  }
  /** fin d'un trait : l'élément complet devient annulable */
  finish(l: Layer, id: string, replaceWith?: El) {
    const e = this.docs[l].get(id);
    if (!e) return;
    if (replaceWith) {
      this.applyLocal({ o: "del", l, ids: [id] });
      this.transport.send({ o: "del", l, ids: [id] });
      this.commit({ o: "add", l, els: [replaceWith] }, [{ o: "del", l, ids: [replaceWith.id] }]);
      return;
    }
    if (e.ttl) return; // l'encre éphémère ne va pas dans l'historique
    this.undoStack.push({ l, ops: [{ o: "del", l, ids: [id] }] });
    this.redoStack = [];
    this.bumpState();
  }
  update(l: Layer, id: string, p: Partial<El>, undoable = true, before?: Partial<El>) {
    const e = this.docs[l].get(id);
    if (!e || !this.canEdit(e)) return;
    const old: Partial<El> = before || {};
    if (!before) for (const k of Object.keys(p) as (keyof El)[]) (old as any)[k] = e[k];
    this.commit({ o: "upd", l, id, p }, undoable ? [{ o: "upd", l, id, p: old }] : null);
  }
  /** plusieurs mises à jour en une seule étape d'annulation */
  updateMany(l: Layer, changes: { id: string; p: Partial<El>; before: Partial<El> }[]) {
    const ok = changes.filter(c => {
      const e = this.docs[l].get(c.id);
      return e && this.canEdit(e);
    });
    if (!ok.length) return;
    for (const c of ok) {
      const op: Op = { o: "upd", l, id: c.id, p: c.p };
      this.applyLocal(op);
      this.transport.send(op);
    }
    this.undoStack.push({ l, ops: ok.map(c => ({ o: "upd", l, id: c.id, p: c.before }) as Op) });
    this.redoStack = [];
    this.bump();
    this.bumpState();
  }
  /** mise à jour en direct sans historique (glisser-déposer) */
  live(l: Layer, id: string, p: Partial<El>) {
    const e = this.docs[l].get(id);
    if (!e || !this.canEdit(e)) return;
    const op: Op = { o: "upd", l, id, p };
    this.applyLocal(op);
    this.transport.send(op);
    this.bump();
  }
  remove(l: Layer, ids: string[]) {
    const els = ids.map(id => this.docs[l].get(id)).filter((e): e is El => !!e && this.canEdit(e));
    if (!els.length) return;
    this.commit({ o: "del", l, ids: els.map(e => e.id) }, [{ o: "add", l, els }]);
  }
  front(l: Layer, ids: string[]) {
    this.commit({ o: "front", l, ids }, null);
  }
  clear(l: Layer) {
    if (!this.isHost) return;
    const els = this.list(l);
    if (!els.length) return;
    this.commit({ o: "clr", l }, [{ o: "add", l, els }]);
  }

  private replay(from: Inverse[], to: Inverse[], l?: Layer) {
    let i = from.length - 1;
    if (l) while (i >= 0 && from[i].l !== l) i--;
    if (i < 0) return;
    const [entry] = from.splice(i, 1);
    const back: Op[] = [];
    for (const op of entry.ops) {
      back.unshift(...this.inverseOf(op));
      this.applyLocal(op);
      this.transport.send(op);
    }
    to.push({ l: entry.l, ops: back });
    this.bump();
    this.bumpState();
  }
  /** inverse d'une opération, calculé avant de l'appliquer */
  private inverseOf(op: Op): Op[] {
    const d = "l" in op ? this.docs[op.l as Layer] : null;
    if (!d) return [];
    switch (op.o) {
      case "add":
        return [{ o: "del", l: op.l, ids: op.els.map(e => e.id) }];
      case "del":
        return [{ o: "add", l: op.l, els: op.ids.map(id => d.get(id)).filter(Boolean) as El[] }];
      case "upd": {
        const e = d.get(op.id);
        if (!e) return [];
        const old: Partial<El> = {};
        for (const k of Object.keys(op.p) as (keyof El)[]) (old as any)[k] = e[k];
        return [{ o: "upd", l: op.l, id: op.id, p: old }];
      }
      default:
        return [];
    }
  }
  undo(l?: Layer) {
    this.replay(this.undoStack, this.redoStack, l);
  }
  redo(l?: Layer) {
    this.replay(this.redoStack, this.undoStack, l);
  }

  // -------------------------------------------------------------- état partagé
  private setStateRaw(s: Partial<WbState>) {
    const papers: Paper[] = ["blank", "grid", "dots", "lines", "seyes"];
    const themes: BoardTheme[] = ["light", "slate", "chalk"];
    this.state = {
      open: !!s.open,
      allow: !!s.allow,
      paper: papers.includes(s.paper as Paper) ? (s.paper as Paper) : this.state.paper,
      theme: themes.includes(s.theme as BoardTheme) ? (s.theme as BoardTheme) : this.state.theme,
    };
    this.bumpState();
    this.bump();
  }
  setState(p: Partial<WbState>) {
    if (!this.isHost) return;
    this.setStateRaw({ ...this.state, ...p });
    this.transport.send({ o: "state", s: this.state });
  }
  sendView(v: View) {
    if (!this.isHost) return;
    this.hostView = v;
    this.transport.send({ o: "view", v }, { lossy: true });
  }
  sendCursor(l: Layer, x: number, y: number, d: boolean) {
    this.transport.send({ o: "cur", l, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, d }, { lossy: true });
  }
  sendLaser(l: Layer, pts: number[]) {
    this.transport.send({ o: "laser", l, pts: pts.map(n => Math.round(n * 10) / 10) }, { lossy: true });
  }
  /** chargement local (professeur qui recharge la page) */
  load(board: El[], screen: El[] = []) {
    for (const e of board) if (!this.docs.board.has(e.id)) this.docs.board.set(e.id, e);
    for (const e of screen) if (!this.docs.screen.has(e.id)) this.docs.screen.set(e.id, e);
    this.bump();
  }
  /** retire l'encre éphémère expirée et les traces de laser ; true s'il reste de l'animation */
  prune(now = Date.now()) {
    let animating = false;
    let changed = false;
    for (const d of Object.values(this.docs)) {
      for (const [id, e] of d) {
        if (e.exp) {
          if (e.exp < now) {
            d.delete(id);
            changed = true;
          } else animating = true;
        }
      }
    }
    for (const [id, t] of this.lasers) {
      let i = 0;
      while (i < t.pts.length && now - t.pts[i + 2] > LASER_MS) i += 3;
      if (i) t.pts.splice(0, i);
      if (!t.pts.length) this.lasers.delete(id);
      else animating = true;
    }
    for (const [id, p] of this.peers) if (now - p.t > 4000) this.peers.delete(id);
    if (changed) this.bump();
    return animating;
  }
}
