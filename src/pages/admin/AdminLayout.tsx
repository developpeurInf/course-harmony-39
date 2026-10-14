import { Suspense, useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Layers, CalendarClock, Wallet, ScrollText, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useT } from "./adminShared";
import { useConfirm } from "./ConfirmDialog";

/** Espace d'administration : menu propre, réservé aux comptes de l'équipe admin */
export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const { isAdmin, adminCan, loading: accessLoading, enforced } = useAccess();
  const navigate = useNavigate();
  const { L, rtl } = useT();
  const { pathname } = useLocation();
  const mobileNav = useRef<HTMLElement>(null);
  const { ask, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  // Téléphone : la pastille active reste visible dans la barre défilante
  useEffect(() => {
    const nav = mobileNav.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    // calcul manuel (scrollIntoView({inline}) est imprécis sur iOS 12 et ferait aussi défiler la page)
    const navRect = nav.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    if (r.left < navRect.left || r.right > navRect.right) {
      nav.scrollLeft += r.left - navRect.left - (navRect.width - r.width) / 2;
    }
  }, [pathname, isAdmin, rtl]);

  if (loading || accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-bold">{L("Accès réservé à l'administration", "الولوج مخصص للإدارة", "Administration only")}</h1>
          <p className="text-sm text-muted-foreground">
            {enforced
              ? L("Votre compte n'a pas de rôle d'administration.", "حسابك لا يملك صلاحية الإدارة.", "Your account has no administration role.")
              : L(
                  "La base de données n'est pas encore à jour : appliquez la migration « abonnements » dans Supabase.",
                  "قاعدة البيانات غير محدثة بعد: طبّق ترحيل « الاشتراكات » في Supabase.",
                  "The database is not up to date yet: apply the “subscriptions” migration in Supabase."
                )}
          </p>
          <button type="button" onClick={() => navigate("/dashboard")} className="text-sm font-semibold text-primary underline">
            {L("Retour", "رجوع", "Back")}
          </button>
        </div>
      </div>
    );
  }

  const items = [
    { to: "/admin", end: true, icon: LayoutDashboard, label: L("Tableau de bord", "لوحة القيادة", "Dashboard"), show: true },
    { to: "/admin/teachers", icon: Users, label: L("Professeurs", "الأساتذة", "Teachers"), show: true },
    { to: "/admin/plans", icon: Layers, label: L("Offres", "العروض", "Plans"), show: true },
    { to: "/admin/subscriptions", icon: CalendarClock, label: L("Abonnements", "الاشتراكات", "Subscriptions"), show: true },
    { to: "/admin/payments", icon: Wallet, label: L("Paiements", "الأداءات", "Payments"), show: true },
    { to: "/admin/audit", icon: ScrollText, label: L("Journal", "السجل", "Audit log"), show: adminCan("admin.audit.view") },
    { to: "/admin/team", icon: ShieldCheck, label: L("Équipe admin", "فريق الإدارة", "Admin team"), show: true },
  ].filter(i => i.show);

  const handleLogout = () => ask({
    title: L("Se déconnecter ?", "تسجيل الخروج؟", "Log out?"),
    confirmLabel: L("Déconnexion", "تسجيل الخروج", "Log out"),
    destructive: true,
    onConfirm: async () => {
      await logout();
      navigate("/login");
    },
  });

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex app-viewport overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Menu latéral (ordinateur / iPad paysage) */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r bg-background lg:flex rtl:border-l rtl:border-r-0">
        <div className="border-b px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 font-mono text-lg font-black text-white dark:bg-white dark:text-slate-900">∞</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">Math infini</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">{L("Administration", "الإدارة", "Administration")}</p>
            </div>
          </div>
        </div>
        <nav aria-label={L("Menu d'administration", "قائمة الإدارة", "Administration menu")} className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(it => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t p-3">
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeToggle />
          </div>
          <p className="truncate px-1 text-xs text-muted-foreground">{user.email}</p>
          <button type="button" onClick={handleLogout} className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
            <LogOut className="h-4 w-4" />
            {L("Déconnexion", "تسجيل الخروج", "Log out")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barre du haut (téléphone / tablette) */}
        <header className="flex-shrink-0 border-b bg-background lg:hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono font-black text-white dark:bg-white dark:text-slate-900">∞</div>
              <span className="truncate text-sm font-bold">{L("Administration", "الإدارة", "Administration")}</span>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSelector />
              <ThemeToggle />
              <button type="button" onClick={handleLogout} aria-label={L("Déconnexion", "تسجيل الخروج", "Log out")} title={L("Déconnexion", "تسجيل الخروج", "Log out")} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav ref={mobileNav} aria-label={L("Menu d'administration", "قائمة الإدارة", "Administration menu")} className="flex gap-1 overflow-x-auto px-2 pb-2" style={{ WebkitOverflowScrolling: "touch" } as any}>
            {items.map(it => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[36px] flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                    isActive ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-muted text-muted-foreground"
                  )
                }
              >
                <it.icon className="h-3.5 w-3.5" />
                {it.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-24 sm:p-5 md:p-6" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="mx-auto w-full max-w-6xl">
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      {confirmDialog}
    </div>
  );
}
