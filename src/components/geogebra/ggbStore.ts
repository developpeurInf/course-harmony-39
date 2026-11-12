/**
 * Constructions GeoGebra gardées dans le navigateur (IndexedDB) :
 * enregistrement automatique, liste « Mes constructions » et reprise de la dernière.
 * Si IndexedDB est indisponible (navigation privée…), on garde les fichiers en mémoire.
 */
import type { GgbAppId } from "./ggbApps";

export interface GgbFileRecord {
  id: string;
  app: GgbAppId;
  name: string;
  updatedAt: number;
  /** fichier .ggb encodé en base64 (getBase64 de l'API GeoGebra) */
  base64: string;
  /** petite vignette PNG (data URL) */
  thumb?: string;
}

export type GgbFileMeta = Omit<GgbFileRecord, "base64">;

const DB_NAME = "geogebra-tools";
const STORE = "files";
let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, GgbFileRecord>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = run(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      })
  );
}

export async function putGgbFile(rec: GgbFileRecord): Promise<void> {
  memory.set(rec.id, rec);
  await tx("readwrite", (s) => s.put(rec));
}

export async function getGgbFile(id: string): Promise<GgbFileRecord | null> {
  const r = await tx<GgbFileRecord>("readonly", (s) => s.get(id));
  return r || memory.get(id) || null;
}

export async function deleteGgbFile(id: string): Promise<void> {
  memory.delete(id);
  await tx("readwrite", (s) => s.delete(id));
}

/** Toutes les constructions (sans le fichier lui-même), de la plus récente à la plus ancienne */
export async function listGgbFiles(app?: GgbAppId): Promise<GgbFileMeta[]> {
  const all = (await tx<GgbFileRecord[]>("readonly", (s) => s.getAll())) || [...memory.values()];
  return all
    .filter((r) => !app || r.app === app)
    .map(({ base64: _b, ...rest }) => rest)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

const LAST_KEY = (app: GgbAppId) => `geogebra:last:${app}`;
export function getLastGgb(app: GgbAppId): string | null {
  try {
    return localStorage.getItem(LAST_KEY(app));
  } catch {
    return null;
  }
}
export function setLastGgb(app: GgbAppId, id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY(app), id);
    else localStorage.removeItem(LAST_KEY(app));
  } catch {
    /* stockage bloqué */
  }
}
