import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Send, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { MODULE_LABELS, PERMISSION_LABELS } from "@/lib/permissions";
import { Label } from "@/components/ui/label";

const db = supabase as any;

const STATUS: Record<string, { fr: string; ar: string; en: string; cls: string }> = {
  active: { fr: "Actif", ar: "نشط", en: "Active", cls: "bg-emerald-100 text-emerald-800" },
  trial: { fr: "Essai", ar: "تجريبي", en: "Trial", cls: "bg-sky-100 text-sky-800" },
  grace: { fr: "Période de grâce", ar: "مهلة السماح", en: "Grace period", cls: "bg-amber-100 text-amber-800" },
  expired: { fr: "Expiré : lecture seule", ar: "منتهي: قراءة فقط", en: "Expired: read-only", cls: "bg-red-100 text-red-800" },
  none: { fr: "Aucun abonnement", ar: "لا يوجد اشتراك", en: "No subscription", cls: "bg-slate-100 text-slate-700" },
  suspended: { fr: "Suspendu", ar: "موقوف", en: "Suspended", cls: "bg-slate-200 text-slate-800" },
};

/** « Mon abonnement » : offre, dates, consommation, contenu, offres disponibles */
export default function MySubscription() {
  const { user } = useAuth();
  const { access, enforced, refresh, loading: accessLoading } = useAccess();
  const { language } = useLanguage();
  const lang = (language === "ar" || language === "en" ? language : "fr") as "fr" | "ar" | "en";
  const L = (fr: string, ar: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const [plans, setPlans] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [wanted, setWanted] = useState<string>("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const load = async () => {
    try {
      const [{ data: p }, { data: c }, { data: r }] = await Promise.all([
        db.from("plans").select("*").eq("is_active", true).order("sort_order"),
        db.from("plan_permissions").select("*"),
        db.from("subscription_requests").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setPlans(p || []);
      setContent(c || []);
      setRequests(r || []);
    } catch (e) {
      console.error("MySubscription load failed", e);
    } finally {
      setLoadingData(false);
    }
  };
  useEffect(() => {
    void refresh();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sub = access?.subscription;
  /** Prix selon la langue (ar : درهم) */
  const fmtPrice = (n: unknown) => {
    const v = Number(n);
    if (!v) return "—";
    try {
      const num = v.toLocaleString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR");
      return lang === "ar" ? `${num} درهم` : `${num} MAD`;
    } catch {
      return lang === "ar" ? `${v} درهم` : `${v} MAD`;
    }
  };
  const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR") : "—");
  const featuresByModule = useMemo(() => {
    const m: Record<string, string[]> = {};
    Object.entries(PERMISSION_LABELS).forEach(([k, v]) => {
      if (v.module === "admin" || v.module === "quota") return;
      (m[v.module] = m[v.module] || []).push(k);
    });
    return m;
  }, []);
  const planHas = (planId: string, key: string) => content.some(c => c.plan_id === planId && c.permission_key === key);
  const planLimit = (planId: string, key: string) => {
    const row = content.find(c => c.plan_id === planId && c.permission_key === key);
    return !row || row.limit_value === null ? "∞" : String(row.limit_value);
  };

  const sendRequest = async () => {
    if (!user || sending) return;
    setSending(true);
    let error: any = null;
    try {
      ({ error } = await db.from("subscription_requests").insert({ teacher_id: user.id, plan_id: wanted || sub?.plan_id || null, message: message || null }));
    } catch (e) {
      error = e;
    }
    setSending(false);
    if (error) {
      console.error("Subscription request failed", error);
      return toast.error(L("Impossible d'envoyer la demande. Réessayez plus tard.", "تعذر إرسال الطلب. حاول لاحقاً.", "Could not send the request. Please try again later."));
    }
    toast.success(L("Demande envoyée à l'administration", "تم إرسال الطلب إلى الإدارة", "Request sent to the administration"));
    setMessage("");
    void load();
  };

  if (accessLoading && !access) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground" role="status">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="sr-only">{L("Chargement…", "جارٍ التحميل…", "Loading…")}</span>
      </div>
    );
  }

  if (!enforced || !access) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        {L("Les abonnements ne sont pas encore activés.", "الاشتراكات غير مفعلة بعد.", "Subscriptions are not enabled yet.")}
      </div>
    );
  }
  const st = STATUS[sub?.status || "none"] || STATUS.none;
  const pending = requests.find(r => r.status === "pending");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{L("Mon abonnement", "اشتراكي", "My subscription")}</h1>
        <p className="text-sm text-muted-foreground">{L("Votre offre, ses limites et ce qu'elle contient.", "عرضك وحدوده ومحتواه.", "Your plan, its limits and what it includes.")}</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold">{sub?.plan_name || "—"}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st[lang]}</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">{L("Début", "البداية", "Start")}</dt><dd className="font-semibold">{fmt(sub?.starts_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{L("Fin", "النهاية", "End")}</dt><dd className="font-semibold">{sub?.ends_at ? fmt(sub.ends_at) : L("Sans fin", "بدون نهاية", "No end")}</dd></div>
            {sub?.days_left !== null && sub?.days_left !== undefined && (
              <div><dt className="text-xs text-muted-foreground">{L("Jours restants", "الأيام المتبقية", "Days left")}</dt><dd className="font-semibold">{sub.days_left}</dd></div>
            )}
            {sub?.grace_ends_at && (
              <div><dt className="text-xs text-muted-foreground">{L("Fin de la grâce", "نهاية المهلة", "Grace ends")}</dt><dd className="font-semibold">{fmt(sub.grace_ends_at)}</dd></div>
            )}
          </dl>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-bold">{L("Consommation", "الاستهلاك", "Usage")}</h2>
          <ul className="mt-3 space-y-3">
            {Object.entries(access.quotas).map(([k, q]) => {
              if (k === "video.max_mb") {
                return (
                  <li key={k} className="flex justify-between gap-2 text-xs">
                    <span className="font-medium">{PERMISSION_LABELS[k]?.[lang] || k}</span>
                    <span className="text-muted-foreground">{q.limit === null ? "∞" : `${q.limit} ${L("Mo", "ميغابايت", "MB")}`}</span>
                  </li>
                );
              }
              const pct = q.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
              return (
                <li key={k}>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="font-medium">{PERMISSION_LABELS[k]?.[lang] || k}</span>
                    <span className="text-muted-foreground">{q.used} / {q.limit === null ? "∞" : q.limit}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${q.limit === null ? 3 : pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-bold">{L("Ce que vous pouvez faire", "ما يمكنك القيام به", "What you can do")}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(featuresByModule).map(([m, keys]) => (
            <div key={m}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{MODULE_LABELS[m]?.[lang] || m}</p>
              <ul className="space-y-1">
                {keys.map(k => {
                  const ok = access.permissions.includes(k);
                  return (
                    <li key={k} className={`flex items-start gap-1.5 text-sm ${ok ? "" : "text-muted-foreground"}`}>
                      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 opacity-50" />}
                      <span>{PERMISSION_LABELS[k][lang]}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {plans.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-bold">{L("Offres disponibles", "العروض المتاحة", "Available plans")}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2 text-start font-semibold" />
                  {plans.map(p => (
                    <th key={p.id} className="px-2 py-2 text-center">
                      <span className={`block font-bold ${p.id === sub?.plan_id ? "text-primary" : "text-foreground"}`}>{p.name}</span>
                      <span className="font-normal">{fmtPrice(p.price_mad)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.keys(access.quotas).map(k => (
                  <tr key={k}>
                    <td className="py-1.5 text-xs">{PERMISSION_LABELS[k]?.[lang] || k}</td>
                    {plans.map(p => <td key={p.id} className="px-2 py-1.5 text-center text-xs font-semibold">{planLimit(p.id, k)}</td>)}
                  </tr>
                ))}
                {Object.values(featuresByModule).flat().filter(k => plans.some(p => !planHas(p.id, k))).map(k => (
                  <tr key={k}>
                    <td className="py-1.5 text-xs">{PERMISSION_LABELS[k][lang]}</td>
                    {plans.map(p => (
                      <td key={p.id} className="px-2 py-1.5 text-center">
                        {planHas(p.id, k) ? <span className="font-bold text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">{L("Les fonctions communes à toutes les offres ne sont pas répétées ici.", "الوظائف المشتركة بين جميع العروض غير مكررة هنا.", "Features shared by every plan are not repeated here.")}</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-bold">{L("Renouveler ou changer d'offre", "تجديد أو تغيير العرض", "Renew or change plan")}</h2>
        {pending ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {L(`Demande envoyée le ${fmt(pending.created_at)} : l'administration va vous contacter.`, `تم إرسال الطلب في ${fmt(pending.created_at)}: ستتصل بك الإدارة.`, `Request sent on ${fmt(pending.created_at)}: the administration will contact you.`)}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {loadingData && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{L("Chargement des offres…", "جارٍ تحميل العروض…", "Loading plans…")}</p>
            )}
            <Label htmlFor="sub-wanted-plan" className="block text-xs">{L("Offre souhaitée", "العرض المطلوب", "Requested plan")}</Label>
            <select id="sub-wanted-plan" className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-72" value={wanted} onChange={e => setWanted(e.target.value)}>
              <option value="">{L("Renouveler mon offre actuelle", "تجديد عرضي الحالي", "Renew my current plan")}</option>
              {plans.filter(p => p.id !== sub?.plan_id).map(p => <option key={p.id} value={p.id}>{L("Passer à", "الانتقال إلى", "Switch to")} {p.name}</option>)}
            </select>
            <Label htmlFor="sub-request-message" className="block text-xs">{L("Message (facultatif)", "رسالة (اختياري)", "Message (optional)")}</Label>
            <Textarea id="sub-request-message" rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder={L("Message (facultatif)", "رسالة (اختياري)", "Message (optional)")} />
            <Button onClick={sendRequest} disabled={sending} className="gap-1.5">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{L("Envoyer la demande", "إرسال الطلب", "Send request")}</Button>
          </div>
        )}
      </section>
    </div>
  );
}
