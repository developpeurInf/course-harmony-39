import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/download";
import { db, fmtDate, fmtMoney, PageTitle, PAYMENT_METHODS, useT } from "./adminShared";

export default function AdminPayments() {
  const { L, lang } = useT();
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; email: string }>>({});
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const { data } = await db.from("payments").select("*, subscriptions(plan_id, plans(name))")
        .gte("paid_at", from).lte("paid_at", to).order("paid_at", { ascending: false });
      setRows(data || []);
      const { data: t } = await db.rpc("admin_teachers");
      const m: Record<string, any> = {};
      (t || []).forEach((r: any) => (m[r.user_id] = { name: r.name, email: r.email }));
      setNames(m);
    })();
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
    const head = ["Date", "Professeur", "E-mail", "Offre", "Montant (MAD)", "Moyen", "Référence", "Reçu"];
    const lines = rows.map(r => [
      r.paid_at, names[r.teacher_id]?.name || "", names[r.teacher_id]?.email || "", r.subscriptions?.plans?.name || "",
      String(r.amount_mad).replace(".", ","), methodLabel(r.method), r.reference || "", r.receipt_number || "",
    ]);
    const csv = "﻿" + [head, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `paiements_${from}_${to}.csv`);
  };

  return (
    <div>
      <PageTitle
        title={L("Paiements", "الأداءات", "Payments")}
        subtitle={L("Les paiements s'enregistrent depuis la fiche de chaque professeur.", "تسجل الأداءات من بطاقة كل أستاذ.", "Payments are recorded from each teacher's page.")}
        actions={<Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" />CSV</Button>}
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs font-semibold">
          <span>{L("Du", "من", "From")}</span>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-semibold">
          <span>{L("Au", "إلى", "To")}</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <div className="rounded-xl border bg-card px-4 py-2">
          <p className="text-xs text-muted-foreground">{L("Total", "المجموع", "Total")}</p>
          <p className="text-lg font-bold">{fmtMoney(total)}</p>
        </div>
        {Object.entries(byMethod).map(([m, v]) => (
          <div key={m} className="rounded-xl border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">{methodLabel(m)}</p>
            <p className="text-sm font-semibold">{fmtMoney(v)}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 ? (
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
                  <span className="text-sm font-bold">{fmtMoney(r.amount_mad)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
