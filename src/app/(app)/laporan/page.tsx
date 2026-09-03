"use client";

import * as React from "react";
import { Banknote, Download, Package, TrendingUp, Wallet } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { compareReport, dashboardReport } from "@/lib/services/reports";
import { listProfiles } from "@/lib/services/admin";
import { Button, Card, EmptyState, LoadingBlock, Select, useToast } from "@/components/ui";
import { PageHeader } from "@/components/app-shell";
import {
  HppWarning,
  PeriodFilter,
  ProfitLadder,
  SectionCard,
  StatCard,
  type PeriodState,
} from "@/components/report-bits";
import { DonutChart, HourlyChart, TrendChart } from "@/components/charts";
import { exportReportPdf } from "@/lib/pdf";
import { PAYMENT_METHOD_LABEL, type ComparePeriods, type DashboardReport, type Profile } from "@/lib/types";
import { isoDate, num, periodRange, rupiah, tanggal } from "@/lib/format";

export default function LaporanPage() {
  const { store, isAdmin, sim, loading: appLoading } = useApp();
  const toast = useToast();

  const [period, setPeriod] = React.useState<PeriodState>({
    preset: "bulan-ini",
    from: isoDate(new Date()),
    to: isoDate(new Date()),
  });
  const [cashier, setCashier] = React.useState<string>("");
  const [profiles, setProfiles] = React.useState<Profile[]>([]);
  const [report, setReport] = React.useState<DashboardReport | null>(null);
  const [compare, setCompare] = React.useState<ComparePeriods | null>(null);
  const [loading, setLoading] = React.useState(true);

  const prefix = store?.currency_prefix ?? "Rp";
  const range = React.useMemo(() => periodRange(period.preset, period.from, period.to), [period]);

  React.useEffect(() => {
    if (!isAdmin) return;
    listProfiles().then(setProfiles).catch(() => setProfiles([]));
  }, [isAdmin]);

  React.useEffect(() => {
    if (appLoading) return;
    let cancelled = false;

    (async () => {
      try {
        const [rep, cmp] = await Promise.all([
          dashboardReport(range.from, range.to, sim, cashier || null),
          compareReport(range.from, range.to, sim, cashier || null),
        ]);
        if (cancelled) return;
        setReport(rep);
        setCompare(cmp);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat laporan", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appLoading, range, sim, cashier, toast]);

  if (appLoading || (loading && !report)) return <LoadingBlock />;

  const kosong = !report || (num(report.jumlah_transaksi) === 0 && num(report.pengeluaran) === 0);

  return (
    <>
      <PageHeader
        title="Laporan"
        description={`${tanggal(range.from)} — ${tanggal(new Date(range.to.getTime() - 1))}${
          sim ? " • data simulasi" : ""
        }`}
        action={
          <Button
            disabled={!report}
            onClick={() =>
              report &&
              exportReportPdf(report, {
                storeName: store?.name ?? "Warkas",
                address: store?.address,
                from: range.from,
                to: range.to,
                sim,
                prefix,
              })
            }
          >
            <Download className="size-4" /> Export PDF
          </Button>
        }
      />

      <div className="mb-5">
        <PeriodFilter
          value={period}
          onChange={setPeriod}
          extra={
            isAdmin && profiles.length > 1 ? (
              <Select
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="w-auto min-w-44"
                aria-label="Filter kasir"
              >
                <option value="">Semua kasir</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            ) : null
          }
        />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Omzet"
          value={rupiah(report?.omzet, prefix)}
          hint={`${num(report?.jumlah_transaksi)} transaksi`}
          tone="blue"
          icon={TrendingUp}
          compare={compare && { now: num(compare.sekarang.omzet), prev: num(compare.sebelumnya.omzet) }}
        />
        <StatCard
          label="Modal barang (HPP)"
          value={rupiah(report?.hpp, prefix)}
          hint="Modal barang yang terjual"
          tone="slate"
          icon={Package}
          compare={compare && { now: num(compare.sekarang.hpp), prev: num(compare.sebelumnya.hpp) }}
        />
        <StatCard
          label="Laba kotor"
          value={rupiah(report?.laba_kotor, prefix)}
          hint={`Margin ${num(report?.margin_kotor).toFixed(1)}%`}
          tone={num(report?.laba_kotor) >= 0 ? "green" : "red"}
          icon={Wallet}
          compare={
            compare && {
              now: num(compare.sekarang.laba_kotor),
              prev: num(compare.sebelumnya.laba_kotor),
            }
          }
        />
        <StatCard
          label="Laba bersih"
          value={rupiah(report?.laba_bersih, prefix)}
          hint={`Margin ${num(report?.margin_bersih).toFixed(1)}%`}
          tone={num(report?.laba_bersih) >= 0 ? "green" : "red"}
          icon={Banknote}
          compare={
            compare && {
              now: num(compare.sekarang.laba_bersih),
              prev: num(compare.sebelumnya.laba_bersih),
            }
          }
        />
      </div>

      {report && num(report.item_tanpa_hpp) > 0 && (
        <div className="mb-5">
          <HppWarning jumlah={num(report.item_tanpa_hpp)} />
        </div>
      )}

      {kosong ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Belum ada data di periode ini"
            description="Ubah rentang tanggal, atau catat transaksi dulu lewat menu Kasir."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {report && <ProfitLadder report={report} prefix={prefix} />}

          <SectionCard title="Tren harian" subtitle="Uang masuk, uang keluar, dan sisa laba">
            <TrendChart data={report!.tren} />
          </SectionCard>

          <SectionCard
            title="Produk paling menguntungkan"
            subtitle="Diurutkan dari laba terbesar, bukan dari yang paling laku"
            className="lg:col-span-2"
          >
            {report!.produk_terlaris.length ? (
              <div className="overflow-x-auto px-2">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-medium">Produk</th>
                      <th className="px-3 py-2 text-right font-medium">Terjual</th>
                      <th className="px-3 py-2 text-right font-medium">Omzet</th>
                      <th className="px-3 py-2 text-right font-medium">Modal</th>
                      <th className="px-3 py-2 text-right font-medium">Laba</th>
                      <th className="px-3 py-2 text-right font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...report!.produk_terlaris]
                      .sort((a, b) => num(b.laba) - num(a.laba))
                      .map((row) => {
                        const omzet = num(row.omzet);
                        const laba = num(row.laba);
                        const margin = omzet > 0 ? (laba / omzet) * 100 : 0;
                        return (
                          <tr key={row.nama} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 font-medium text-slate-900">{row.nama}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                              {row.qty}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                              {rupiah(omzet, prefix)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                              {rupiah(num(row.hpp), prefix)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-medium tabular-nums ${
                                laba >= 0 ? "text-emerald-700" : "text-red-600"
                              }`}
                            >
                              {rupiah(laba, prefix)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                              {margin.toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Belum ada penjualan produk" />
            )}
          </SectionCard>

          <SectionCard title="Jam ramai" subtitle="Kapan pelanggan paling banyak datang">
            <HourlyChart data={report!.per_jam} />
          </SectionCard>

          <SectionCard title="Metode pembayaran">
            {report!.metode_bayar.length ? (
              <DonutChart
                data={report!.metode_bayar.map((m) => ({
                  name: PAYMENT_METHOD_LABEL[m.metode] ?? m.metode,
                  value: num(m.total),
                }))}
              />
            ) : (
              <EmptyState title="Belum ada transaksi" />
            )}
          </SectionCard>

          <SectionCard title="Pengeluaran per kategori">
            {report!.kategori_pengeluaran.length ? (
              <DonutChart
                data={report!.kategori_pengeluaran.map((c) => ({
                  name: c.kategori,
                  value: num(c.total),
                  color: c.warna,
                }))}
              />
            ) : (
              <EmptyState title="Belum ada pengeluaran" />
            )}
          </SectionCard>

          <SectionCard
            title="Rincian harian"
            subtitle="Angka mentah untuk pembukuan"
            className="lg:col-span-2"
          >
            <div className="overflow-x-auto px-2">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Tanggal</th>
                    <th className="px-3 py-2 text-right font-medium">Transaksi</th>
                    <th className="px-3 py-2 text-right font-medium">Omzet</th>
                    <th className="px-3 py-2 text-right font-medium">Modal (HPP)</th>
                    <th className="px-3 py-2 text-right font-medium">Pengeluaran</th>
                    <th className="px-3 py-2 text-right font-medium">Laba bersih</th>
                  </tr>
                </thead>
                <tbody>
                  {report!.tren.map((t) => {
                    const laba = num(t.omzet) - num(t.hpp) - num(t.pengeluaran);
                    return (
                      <tr key={t.tanggal} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-600">
                          {tanggal(`${t.tanggal}T00:00:00`)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {t.transaksi}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {rupiah(t.omzet, prefix)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {rupiah(t.hpp, prefix)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                          {rupiah(t.pengeluaran, prefix)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium tabular-nums ${
                            laba >= 0 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {rupiah(laba, prefix)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}
