import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "@/lib/router";
import { LayoutDashboard, Users, Layers, CalendarClock, Wallet, ScrollText, ShieldCheck, LogOut, Palette, Megaphone, Gift, LifeBuoy, LibraryBig } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/AppBrand";
import { db, useT } from "./adminShared";
import { useConfirm } from "./ConfirmDialog";
import { AdminMfaGate } from "./AdminMfa";

/** Espace d'administration : menu propre, réservé aux comptes de l'équipe admin */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { isAdmin, adminCan, access, loading: accessLoading, enforced } = useAccess();
  const { settings: appSettings } = useAppSettings();
  const navigate = useNavigate();
  const { L, rtl } = useT();
  const { pathname } = useLocation();
  const mobileNav = useRef<HTMLElement>(null);
  const { ask, dialog: confirmDialog } = useConfirm();
  const canSupport = adminCan("admin.support.manage");
  const [supportUnread, setSupportUnread] = useState(0);

  // Pastille du menu Support : tickets à traiter non lus
  useEffect(() => {
    if (!canSupport) return;
    const tick = () => db.rpc("support_unread_count").then(({ data }: any) => setSupportUnread(Number(data) || 0));
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [canSupport, pathname]);

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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground/70" />
      </div>
    );
  }
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{L("Accès réservé à l'administration", "الولوج مخصص للإدارة", "Administration only")}</h1>
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
    { to: "/admin/promos", icon: Gift, label: L("Codes promo", "رموز التخفيض", "Promo codes"), show: adminCan("admin.plans.manage") },
    { to: "/admin/announcements", icon: Megaphone, label: L("Annonces", "الإعلانات", "Announcements"), show: adminCan("admin.settings.manage") },
    { to: "/admin/support", icon: LifeBuoy, label: L("Support", "الدعم", "Support"), show: canSupport, badge: supportUnread },
    { to: "/admin/library", icon: LibraryBig, label: L("Bibliothèque", "المكتبة", "Library"), show: adminCan("admin.library.manage") },
    { to: "/admin/audit", icon: ScrollText, label: L("Journal", "السجل", "Audit log"), show: adminCan("admin.audit.view") },
    { to: "/admin/team", icon: ShieldCheck, label: L("Équipe admin", "فريق الإدارة", "Admin team"), show: true },
    {
      to: "/admin/customization",
      icon: Palette,
      label: L("Personnalisation", "التخصيص", "Customization"),
      show: access?.admin_role === "super_admin" || adminCan("admin.settings.manage"),
    },
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
    <div dir={rtl ? "rtl" : "ltr"} className="flex app-viewport overflow-hidden bg-background">
      {/* Menu latéral (ordinateur / iPad paysage) */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-e bg-sidebar lg:flex">
        <div className="flex h-14 items-center px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark logoUrl={appSettings.identity.logoUrl || null} alt="" size="sm" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{appSettings.identity.appName || "Math infini"}</p>
              <p className="truncate text-2xs text-muted-foreground">{L("Administration", "الإدارة", "Administration")}</p>
            </div>
          </div>
        </div>
        <nav aria-label={L("Menu d'administration", "قائمة الإدارة", "Administration menu")} className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
          {items.map(it => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                )
              }
            >
              <it.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              {it.label}
              {"badge" in it && it.badge ? <span className="ms-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">{it.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t p-2.5">
          <div className="flex items-center gap-2">
            <LanguageSelector placement="top" align="start" />
            <ThemeToggle placement="top" align="start" />
          </div>
          <p className="truncate px-2 text-xs text-muted-foreground">{user.email}</p>
          <button type="button" onClick={handleLogout} className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-destructive hover:bg-destructive/10">
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
              <BrandMark logoUrl={appSettings.identity.logoUrl || null} alt="" size="sm" />
              <span className="truncate text-sm font-semibold">{L("Administration", "الإدارة", "Administration")}</span>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSelector />
              <ThemeToggle />
              <button type="button" onClick={handleLogout} aria-label={L("Déconnexion", "تسجيل الخروج", "Log out")} title={L("Déconnexion", "تسجيل الخروج", "Log out")} className="flex h-9 w-9 items-center justify-center rounded-md text-destructive hover:bg-destructive/10">
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
                    "flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <it.icon className="h-3.5 w-3.5" />
                {it.label}
                {"badge" in it && it.badge ? <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">{it.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 pb-24 sm:px-6 md:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground/70" />
                </div>
              }
            >
              <AdminMfaGate>{children}</AdminMfaGate>
            </Suspense>
          </div>
        </main>
      </div>
      {confirmDialog}
    </div>
  );
}
