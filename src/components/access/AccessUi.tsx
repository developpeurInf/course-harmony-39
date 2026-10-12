import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, AlertTriangle, Clock, Ban } from "lucide-react";
import { useAccess, permissionLabel } from "@/contexts/AccessContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PermissionKey } from "@/lib/permissions";

const useL = () => {
  const { language } = useLanguage();
  return (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
};

/** Page entière réservée à une permission (route) */
export function RequirePermission({ perm, children }: { perm: PermissionKey; children: ReactNode }) {
  const { can, loading } = useAccess();
  const L = useL();
  if (loading) return null;
  if (can(perm)) return <>{children}</>;
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="mt-3 text-lg font-bold">{permissionLabel(perm)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {L("Cette fonction n'est pas incluse dans votre offre actuelle.", "هذه الوظيفة غير مدرجة في عرضك الحالي.", "This feature is not included in your current plan.")}
      </p>
      <Link to="/subscription" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        {L("Voir mon abonnement", "عرض اشتراكي", "See my subscription")}
      </Link>
    </div>
  );
}

/** Petit cadenas à côté d'un bouton non inclus dans l'offre */
export function LockBadge({ perm }: { perm: PermissionKey }) {
  const { can } = useAccess();
  if (can(perm)) return null;
  return <Lock className="inline h-3 w-3 opacity-70" aria-label="locked" />;
}

/** Bandeau d'expiration / lecture seule en haut de l'espace professeur */
export function SubscriptionBanner() {
  const { user } = useAuth();
  const { access, enforced, isAdmin } = useAccess();
  const L = useL();
  if (!enforced || isAdmin || user?.role !== "professor" || !access) return null;
  const s = access.subscription;
  const days = s.days_left;

  let tone = "";
  let icon = Clock;
  let text = "";
  if (s.status === "suspended") {
    tone = "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
    icon = Ban;
    text = L("Votre compte est suspendu. Contactez l'administration.", "حسابك موقوف. اتصل بالإدارة.", "Your account is suspended. Contact the administration.");
  } else if (s.status === "expired" || s.status === "none") {
    tone = "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
    icon = AlertTriangle;
    text = L("Votre abonnement a expiré : votre compte est en lecture seule. Vos données sont conservées.",
      "انتهى اشتراكك: حسابك في وضع القراءة فقط. بياناتك محفوظة.",
      "Your subscription has expired: your account is read-only. Your data is kept.");
  } else if (s.status === "grace") {
    tone = "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    icon = AlertTriangle;
    text = L(`Votre abonnement est terminé. Période de grâce jusqu'au ${fmt(s.grace_ends_at)} : renouvelez-le pour éviter le passage en lecture seule.`,
      `انتهى اشتراكك. مهلة السماح إلى غاية ${fmt(s.grace_ends_at)}: جدده لتفادي وضع القراءة فقط.`,
      `Your subscription has ended. Grace period until ${fmt(s.grace_ends_at)}: renew it to avoid read-only mode.`);
  } else if ((s.status === "active" || s.status === "trial") && days !== null && days <= 7) {
    tone = "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
    text = s.status === "trial"
      ? L(`Votre essai se termine dans ${days} jour(s).`, `تنتهي فترتك التجريبية خلال ${days} يوم.`, `Your trial ends in ${days} day(s).`)
      : L(`Votre abonnement expire dans ${days} jour(s), le ${fmt(s.ends_at)}.`, `ينتهي اشتراكك خلال ${days} يوم، في ${fmt(s.ends_at)}.`, `Your subscription ends in ${days} day(s), on ${fmt(s.ends_at)}.`);
  } else {
    return null;
  }
  const Icon = icon;
  return (
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${tone}`}>
      <span className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{text}</span>
      </span>
      <Link to="/subscription" className="flex-shrink-0 text-xs font-bold underline">
        {L("Mon abonnement", "اشتراكي", "My subscription")}
      </Link>
    </div>
  );
}

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return d.slice(0, 10);
  }
}
