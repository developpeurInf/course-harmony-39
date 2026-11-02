/**
 * Fichiers des Outils Office, gardés dans le navigateur (IndexedDB) :
 * enregistrement automatique, liste « Récents » et reprise du dernier document.
 * Si IndexedDB est indisponible (navigation privée…), on garde les fichiers en mémoire.
 */
export type OfficeApp = "word" | "excel" | "ppt";

export interface OfficeFileRecord<T = unknown> {
  id: string;
  app: OfficeApp;
  name: string;
  updatedAt: number;
  data: T;
  /** aperçu texte (première ligne…) pour la liste des récents */
  preview?: string;
}

const DB_NAME = "office-tools";
const STORE = "files";
let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, OfficeFileRecord>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("app", "app");
        }
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
          const t = db.transaction(STORE, mode);
          const req = run(t.objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      })
  );
}

export async function putOfficeFile(rec: OfficeFileRecord): Promise<void> {
  memory.set(rec.id, rec);
  await tx("readwrite", (s) => s.put(rec));
}

export async function getOfficeFile<T>(id: string): Promise<OfficeFileRecord<T> | null> {
  const r = await tx<OfficeFileRecord<T>>("readonly", (s) => s.get(id));
  return r || (memory.get(id) as OfficeFileRecord<T>) || null;
}

export async function deleteOfficeFile(id: string): Promise<void> {
  memory.delete(id);
  await tx("readwrite", (s) => s.delete(id));
}

/** Liste sans les données (légère) des fichiers d'une application, du plus récent au plus ancien */
export async function listOfficeFiles(app: OfficeApp): Promise<Omit<OfficeFileRecord, "data">[]> {
  const all = (await tx<OfficeFileRecord[]>("readonly", (s) => s.index("app").getAll(app))) || [...memory.values()].filter((r) => r.app === app);
  return all
    .map(({ data: _d, ...rest }) => rest)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

const LAST_KEY = (app: OfficeApp) => `office:last:${app}`;
export function getLastOpened(app: OfficeApp): string | null {
  try {
    return localStorage.getItem(LAST_KEY(app));
  } catch {
    return null;
  }
}
export function setLastOpened(app: OfficeApp, id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY(app), id);
    else localStorage.removeItem(LAST_KEY(app));
  } catch {
    /* stockage bloqué */
  }
}

export const newFileId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Lecture d'un fichier choisi par l'utilisateur */
export function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Choisir un fichier (sans élément <input> permanent dans la page) */
export function pickFile(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.onchange = () => {
      resolve(Array.from(input.files || []));
      input.remove();
    };
    input.click();
    // annulation : rien n'est renvoyé (le focus revient sur la fenêtre)
    window.addEventListener("focus", () => setTimeout(() => { if (document.body.contains(input)) { input.remove(); resolve([]); } }, 800), { once: true });
  });
}

export const stripExt = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, "");
