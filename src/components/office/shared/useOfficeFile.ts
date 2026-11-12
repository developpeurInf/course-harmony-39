import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLastOpened, getOfficeFile, newFileId, putOfficeFile, setLastOpened, type OfficeApp, type OfficeFileRecord } from "./officeStore";
import { debounce } from "./useOfficeEnv";
import type { SaveState } from "./OfficeShell";

/**
 * Fichier en cours d'un Outil Office : identifiant, nom, état d'enregistrement
 * et enregistrement automatique (1,5 s après la dernière modification, et en
 * quittant la page).
 */
export function useOfficeFile<T>(app: OfficeApp, read: () => { data: T; preview?: string } | null) {
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const idRef = useRef<string | null>(null);
  const nameRef = useRef("");
  const readRef = useRef(read);
  readRef.current = read;
  const dirtyRef = useRef(false);

  const saveNow = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    const snap = readRef.current();
    if (!snap) return;
    setSaveState("saving");
    try {
      await putOfficeFile({ id, app, name: nameRef.current, updatedAt: Date.now(), data: snap.data, preview: snap.preview });
      dirtyRef.current = false;
      setSaveState("saved");
    } catch (e) {
      console.error("office save", e);
      setSaveState("dirty");
    }
  }, [app]);

  const debounced = useMemo(() => debounce(() => { void saveNow(); }, 1500), [saveNow]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("dirty");
    debounced();
  }, [debounced]);

  /** Nouveau fichier (ou fichier importé) : il devient le fichier courant */
  const startFile = useCallback((name: string, id = newFileId()) => {
    debounced.cancel();
    idRef.current = id;
    nameRef.current = name;
    setFileId(id);
    setFileName(name);
    setLastOpened(app, id);
    dirtyRef.current = true;
    setSaveState("dirty");
    return id;
  }, [app, debounced]);

  const openRecord = useCallback(async (id: string): Promise<OfficeFileRecord<T> | null> => {
    const rec = await getOfficeFile<T>(id);
    if (!rec) return null;
    debounced.cancel();
    idRef.current = rec.id;
    nameRef.current = rec.name;
    setFileId(rec.id);
    setFileName(rec.name);
    setLastOpened(app, rec.id);
    dirtyRef.current = false;
    setSaveState("saved");
    return rec;
  }, [app, debounced]);

  const loadLast = useCallback(async () => {
    const last = getLastOpened(app);
    return last ? openRecord(last) : null;
  }, [app, openRecord]);

  const rename = useCallback((name: string) => {
    nameRef.current = name;
    setFileName(name);
    markDirty();
  }, [markDirty]);

  // Enregistrement en quittant la page ou l'éditeur
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) { debounced.cancel(); void saveNow(); } };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [debounced, saveNow]);

  return { fileId, fileName, saveState, saveNow, markDirty, startFile, openRecord, loadLast, rename };
}
