import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/download";
import { db, fmtDate, fmtMoney, localDateStr, PageTitle, PAYMENT_METHODS, useT } from "./adminShared";

export default function AdminPayments() {
  const { L, lang } = useT();
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; email: string }>>({});
  // dates LOCALES (pas toISOString, qui donnerait la veille au Maroc juste après minuit)
  const [from, setFrom] = useState(() => localDateStr(new Date(new Date().getFullYear(), 0, 1)));
  const [to, setTo] = useState(() => localDateStr(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      let q = db.from("payments").select("*, subscriptions(plan_id, plans(name))");
      if (from) q = q.gte("paid_at", from);
      if (to) q = q.lte("paid_at", to);
      const [{ data, error: e1 }, { data: t, error: e2 }] = await Promise.all([
        q.order("paid_at", { ascending: false }),
        db.rpc("admin_teachers"),
      ]);
      if (!alive) return;
      const err = e1 || e2;
      if (err) {
        setError(err.message);
        toast.error(L(`Chargement des paiements impossible : ${err.message}`, `تعذر تحميل الأداءات: ${err.message}`, `Could not load payments: ${err.message}`));
      }
      setRows(data || []);
      const m: Record<string, any> = {};
      (t || []).forEach((r: any) => (m[r.user_id] = { name: r.name, email: r.email }));
      setNames(m);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount_mad || 0), 0), [rows]);
  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach(r => (m[r.method] = (m[r.method] || 0) + Number(r.amount_mad || 0)));
    return m;
  }, [rows]);
  const methodLabel = (id: string) => {
    const m = PAYMENT_METHODS.find(x => x.id === id);
    return m ? L(m.fr, m.ar, m.en) : id;
  };

  const exportCsv = () => {
    const head = [
      L("Date", "التاريخ", "Date"), L("Professeur", "الأستاذ", "Teacher"), L("E-mail", "البريد الإلكتروني", "Email"), L("Offre", "العرض", "Plan"),
      L("Montant (MAD)", "المبلغ (درهم)", "Amount (MAD)"), L("Moyen", "الوسيلة", "Method"), L("Référence", "المرجع", "Reference"), L("Reçu", "الوصل", "Receipt"),
    ];
    const lines = rows.map(r => [
      r.paid_at, names[r.teacher_id]?.name || "", names[r.teacher_id]?.email || "", r.subscriptions?.plans?.name || "",
      lang === "en" ? String(r.amount_mad) : String(r.amount_mad).replace(".", ","), methodLabel(r.method), r.reference || "", r.receipt_number || "",
    ]);
    const csv = "﻿" + [head, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${L("paiements", "payments", "payments")}_${from}_${to}.csv`);
  };

  return (
    <div>
      <PageTitle
        title={L("Paiements", "الأداءات", "Payments")}
        subtitle={L("Les paiements s'enregistrent depuis la fiche de chaque professeur.", "تسجل الأداءات من بطاقة كل أستاذ.", "Payments are recorded from each teacher's page.")}
        actions={<Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={loading || !rows.length} aria-label={L("Exporter en CSV", "تصدير بصيغة CSV", "Export as CSV")}><Download className="h-4 w-4" />CSV</Button>}
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1 text-xs font-semibold">
          <label htmlFor="pay-from" className="block">{L("Du", "من", "From")}</label>
          <Input id="pay-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1 text-xs font-semibold">
          <label htmlFor="pay-to" className="block">{L("Au", "إلى", "To")}</label>
          <Input id="pay-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="rounded-xl border bg-card px-4 py-2">
          <p className="text-xs text-muted-foreground">{L("Total", "المجموع", "Total")}</p>
          <p className="text-lg font-bold">{loading ? "…" : fmtMoney(total, lang)}</p>
        </div>
        {Object.entries(byMethod).map(([m, v]) => (
          <div key={m} className="rounded-xl border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">{methodLabel(m)}</p>
            <p className="text-sm font-semibold">{fmtMoney(v, lang)}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="h-32 animate-pulse bg-muted/40" />
        ) : error ? (
          <p role="alert" className="p-6 text-center text-sm text-red-700 dark:text-red-300">
            {L("Impossible de charger les paiements : ", "تعذر تحميل الأداءات: ", "Could not load payments: ")}{error}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{L("Aucun paiement sur la période.", "لا يوجد أي أداء خلال هذه الفترة.", "No payment in this period.")}</p>
        ) : (
          <ul className="divide-y">
            {rows.map(r => (
              <li key={r.id}>
                <Link to={`/admin/teachers/${r.teacher_id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{names[r.teacher_id]?.name || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fmtDate(r.paid_at, lang)} · {methodLabel(r.method)}{r.subscriptions?.plans?.name ? ` · ${r.subscriptions.plans.name}` : ""}{r.reference ? ` · ${r.reference}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{fmtMoney(r.amount_mad, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
