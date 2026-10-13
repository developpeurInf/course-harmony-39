import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { PERMISSION_LABELS, type PermissionKey, type QuotaKey } from "@/lib/permissions";

/**
 * Habilitations du professeur (offre + abonnement + exceptions), lues dans la base
 * via la fonction my_access(). La base de données applique les mêmes règles
 * (RLS + déclencheurs) : ici on se contente de masquer / griser et d'expliquer.
 */

export type SubscriptionStatus = "none" | "trial" | "active" | "grace" | "expired" | "suspended";

export interface AccessInfo {
  is_admin: boolean;
  admin_role: "super_admin" | "admin" | null;
  admin_permissions: string[];
  account_status: "active" | "suspended";
  must_change_password: boolean;
  subscription: {
    status: SubscriptionStatus;
    plan_id: string | null;
    plan_name: string | null;
    kind: "trial" | "paid" | "free" | null;
    starts_at: string | null;
    ends_at: string | null;
    grace_ends_at: string | null;
    days_left: number | null;
  };
  permissions: string[];
  quotas: Record<string, { limit: number | null; used: number }>;
}

interface AccessContextType {
  loading: boolean;
  /** false tant que la migration « abonnements » n'est pas appliquée : tout reste autorisé */
  enforced: boolean;
  access: AccessInfo | null;
  isAdmin: boolean;
  status: SubscriptionStatus | null;
  readOnly: boolean;
  can: (key: PermissionKey) => boolean;
  adminCan: (key: string) => boolean;
  quota: (key: QuotaKey) => { limit: number | null; used: number; remaining: number | null };
  /** true si autorisé ; sinon affiche un message et renvoie false */
  guard: (key: PermissionKey) => boolean;
  /** vérifie qu'on peut ajouter `adding` éléments au quota */
  guardQuota: (key: QuotaKey, adding?: number) => boolean;
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessContextType | undefined>(undefined);

const lang = () => {
  try {
    return localStorage.getItem("maataoui-language") || "fr";
  } catch {
    return "fr";
  }
};
const tr = (fr: string, ar: string, en: string) => {
  const l = lang();
  return l === "ar" ? ar : l === "en" ? en : fr;
};

export const permissionLabel = (key: string) => {
  const p = PERMISSION_LABELS[key];
  if (!p) return key;
  const l = lang();
  return l === "ar" ? p.ar : l === "en" ? p.en : p.fr;
};

// Accès global (fonctions hors composants : CourseContext, utilitaires…)
let current: AccessContextType | null = null;
export const accessStore = {
  can: (key: PermissionKey) => (current ? current.can(key) : true),
  guard: (key: PermissionKey) => (current ? current.guard(key) : true),
  guardQuota: (key: QuotaKey, adding = 1) => (current ? current.guardQuota(key, adding) : true),
  refresh: () => current?.refresh(),
};

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [enforced, setEnforced] = useState(false);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;
  const isProfessor = user?.role === "professor";
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    if (!userId) {
      setAccess(null);
      setLoading(false);
      return;
    }
    lastLoad.current = Date.now();
    const { data, error } = await (supabase as any).rpc("my_access");
    if (error) {
      // fonction absente (migration non appliquée) : on ne bloque rien
      setEnforced(false);
      setAccess(null);
    } else {
      setEnforced(true);
      setAccess(data as AccessInfo);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Les changements faits par l'administration s'appliquent tout de suite, sans reconnexion :
  // 1) temps réel (Supabase Realtime) sur les exceptions, abonnements, compte et offres ;
  // 2) filet de sécurité : relecture au retour sur l'onglet et toutes les 60 s.
  useEffect(() => {
    if (!userId) return;
    let pending: number | undefined;
    const soon = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => void load(), 300);
    };
    const onFocus = () => {
      if (Date.now() - lastLoad.current > 5000) void load();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("access-refresh", soon);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void load(), 60 * 1000);

    let channel: any = null;
    try {
      channel = (supabase as any)
        .channel(`access-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "teacher_permission_overrides", filter: `teacher_id=eq.${userId}` }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `teacher_id=eq.${userId}` }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "teacher_accounts", filter: `user_id=eq.${userId}` }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "plan_permissions" }, soon)
        .subscribe();
    } catch {
      channel = null;
    }
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("access-refresh", soon);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      window.clearTimeout(pending);
      if (channel) (supabase as any).removeChannel(channel);
    };
  }, [userId, load]);

  const isAdmin = !!access?.is_admin;
  const gated = enforced && isProfessor && !isAdmin;
  const status = access?.subscription?.status ?? null;

  const can = useCallback(
    (key: PermissionKey) => {
      if (!gated) return true;
      return !!access?.permissions?.includes(key);
    },
    [gated, access]
  );

  const adminCan = useCallback((key: string) => !!access?.admin_permissions?.includes(key), [access]);

  const quota = useCallback(
    (key: QuotaKey) => {
      const q = gated ? access?.quotas?.[key] : undefined;
      const limit = q?.limit ?? null;
      const used = q?.used ?? 0;
      return { limit, used, remaining: limit === null ? null : Math.max(0, limit - used) };
    },
    [gated, access]
  );

  const explain = useCallback(
    (key: string) => {
      if (status === "suspended") {
        return tr("Votre compte est suspendu. Contactez l'administration.", "حسابك موقوف. يرجى الاتصال بالإدارة.", "Your account is suspended. Please contact the administration.");
      }
      if (status === "expired" || status === "none") {
        return tr(
          "Votre abonnement a expiré : votre compte est en lecture seule. Contactez l'administration pour le renouveler.",
          "انتهى اشتراكك: حسابك في وضع القراءة فقط. اتصل بالإدارة لتجديده.",
          "Your subscription has expired: your account is read-only. Contact the administration to renew it."
        );
      }
      return tr(
        `« ${permissionLabel(key)} » n'est pas inclus dans votre offre.`,
        `« ${permissionLabel(key)} » غير مُدرج في عرضك.`,
        `“${permissionLabel(key)}” is not included in your plan.`
      );
    },
    [status]
  );

  const guard = useCallback(
    (key: PermissionKey) => {
      if (can(key)) return true;
      toast.error(explain(key), {
        description: tr("Voir « Mon abonnement » pour les détails.", "راجع « اشتراكي » للتفاصيل.", "See “My subscription” for details."),
      });
      return false;
    },
    [can, explain]
  );

  const guardQuota = useCallback(
    (key: QuotaKey, adding = 1) => {
      const q = quota(key);
      if (q.limit === null || q.used + adding <= q.limit) {
        // l'action va consommer le quota : on relit la consommation juste après
        if (q.limit !== null) window.setTimeout(() => void load(), 4000);
        return true;
      }
      toast.error(
        tr(
          `Limite de votre offre atteinte : ${permissionLabel(key)} (${q.used}/${q.limit}).`,
          `تم بلوغ حد عرضك: ${permissionLabel(key)} (${q.used}/${q.limit}).`,
          `Plan limit reached: ${permissionLabel(key)} (${q.used}/${q.limit}).`
        ),
        { description: tr("Contactez l'administration pour passer à une offre supérieure.", "اتصل بالإدارة للانتقال إلى عرض أعلى.", "Contact the administration to upgrade.") }
      );
      return false;
    },
    [quota, load]
  );

  const value = useMemo<AccessContextType>(
    () => ({
      loading,
      enforced,
      access,
      isAdmin,
      status,
      readOnly: gated && (status === "expired" || status === "none" || status === "suspended"),
      can,
      adminCan,
      quota,
      guard,
      guardQuota,
      refresh: load,
    }),
    [loading, enforced, access, isAdmin, status, gated, can, adminCan, quota, guard, guardQuota, load]
  );
  current = value;

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used within an AccessProvider");
  return ctx;
}

/** Affiche ses enfants seulement si la permission est accordée (ou `fallback`) */
export function Can({ perm, children, fallback = null }: { perm: PermissionKey; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can } = useAccess();
  return <>{can(perm) ? children : fallback}</>;
}
