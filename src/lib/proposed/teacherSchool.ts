import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cached: { id: string; school: string } | null = null;

/** Lycée du professeur saisi par l'administration (teacher_accounts.school) */
export function useTeacherSchool(userId?: string | null): string {
  const [school, setSchool] = useState(cached && cached.id === userId ? cached.school : "");
  useEffect(() => {
    if (!userId || (cached && cached.id === userId)) return;
    let alive = true;
    (supabase as any).from("teacher_accounts").select("school").eq("user_id", userId).maybeSingle()
      .then(({ data }: any) => {
        cached = { id: userId, school: (data?.school || "").trim() };
        if (alive) setSchool(cached.school);
      });
    return () => { alive = false; };
  }, [userId]);
  return school;
}
