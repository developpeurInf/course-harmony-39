/**
 * Fonctions de l'espace élève accordées par l'offre de son professeur (rpc student_features).
 * Un professeur ou un administrateur voit tout. Avant la migration : tout est ouvert.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentFeatures {
  progress: boolean;
  badges: boolean;
  remediation: boolean;
  reminders: boolean;
}

const ALL: StudentFeatures = { progress: true, badges: true, remediation: true, reminders: true };
let cache: { uid: string; value: StudentFeatures } | null = null;
let pending: Promise<StudentFeatures> | null = null;

async function fetchFeatures(uid: string): Promise<StudentFeatures> {
  if (cache?.uid === uid) return cache.value;
  if (!pending) {
    pending = (supabase as any).rpc("student_features").then(({ data, error }: any) => {
      const value: StudentFeatures = error || !data ? ALL : { ...ALL, ...data };
      cache = { uid, value };
      pending = null;
      return value;
    });
  }
  return pending as Promise<StudentFeatures>;
}

/** null tant que la réponse n'est pas arrivée */
export function useStudentFeatures(uid: string | undefined): StudentFeatures | null {
  const [f, setF] = useState<StudentFeatures | null>(cache && cache.uid === uid ? cache.value : null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    fetchFeatures(uid).then((v) => { if (alive) setF(v); });
    return () => { alive = false; };
  }, [uid]);
  return f;
}
