"use client";

import * as React from "react";
import { Banknote, Download, Receipt, TrendingUp, Wallet } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { compareReport, dashboardReport } from "@/lib/services/reports";
import { listProfiles } from "@/lib/services/admin";
import { Button, Card, EmptyState, LoadingBlock, Select, useToast } from "@/components/ui";
import { PageHeader } from "@/components/app-shell";
import { PeriodFilter, SectionCard, StatCard, type PeriodState } from "@/components/report-bits";
import { DonutChart, HourlyChart, TopProductsChart, TrendChart } from "@/components/charts";
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
          tone="green"
          icon={TrendingUp}
          compare={compare && { now: num(compare.sekarang.omzet), prev: num(compare.sebelumnya.omzet) }}
        />
        <StatCard
          label="Pengeluaran"
          value={rupiah(report?.pengeluaran, prefix)}
          tone="amber"
          icon={Wallet}
          compare={
            compare && {
              now: num(compare.sekarang.pengeluaran),
              prev: num(compare.sebelumnya.pengeluaran),
            }
          }
        />
        <StatCard
          label="Laba bersih"
          value={rupiah(report?.laba_bersih, prefix)}
          hint="Omzet − pengeluaran"
          tone={num(report?.laba_bersih) >= 0 ? "green" : "red"}
          icon={Banknote}
          compare={
            compare && {
              now: num(compare.sekarang.laba_bersih),
              prev: num(compare.sebelumnya.laba_bersih),
            }
          }
        />
        <StatCard
          label="Total diskon"
          value={rupiah(report?.total_diskon, prefix)}
          hint={`Rata-rata struk ${rupiah(report?.rata_transaksi, prefix)}`}
          tone="blue"
          icon={Receipt}
        />
      </div>

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
          <SectionCard
            title="Tren harian"
            subtitle="Omzet dibanding pengeluaran"
            className="lg:col-span-2"
          >
            <TrendChart data={report!.tren} />
          </SectionCard>

          <SectionCard title="Produk terlaris" subtitle="10 produk dengan penjualan terbanyak">
            {report!.produk_terlaris.length ? (
              <TopProductsChart data={report!.produk_terlaris} />
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
                    <th className="px-3 py-2 text-right font-medium">Pengeluaran</th>
                    <th className="px-3 py-2 text-right font-medium">Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {report!.tren.map((t) => {
                    const laba = num(t.omzet) - num(t.pengeluaran);
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
