"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  ClipboardList,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { compareReport, dashboardReport } from "@/lib/services/reports";
import { listLowStock } from "@/lib/services/catalog";
import { getOpenShift } from "@/lib/services/sales";
import { Badge, Button, Card, EmptyState, LoadingBlock, useToast } from "@/components/ui";
import { PageHeader } from "@/components/app-shell";
import { PeriodFilter, SectionCard, StatCard, type PeriodState } from "@/components/report-bits";
import { DonutChart, HourlyChart, TopProductsChart, TrendChart } from "@/components/charts";
import { PAYMENT_METHOD_LABEL, type ComparePeriods, type DashboardReport, type Product, type Shift } from "@/lib/types";
import { isoDate, jam, num, periodRange, rupiah } from "@/lib/format";

export default function DashboardPage() {
  const { profile, store, isAdmin, sim, loading: appLoading } = useApp();
  const toast = useToast();

  const [period, setPeriod] = React.useState<PeriodState>({
    preset: "30-hari",
    from: isoDate(new Date()),
    to: isoDate(new Date()),
  });
  const [report, setReport] = React.useState<DashboardReport | null>(null);
  const [compare, setCompare] = React.useState<ComparePeriods | null>(null);
  const [lowStock, setLowStock] = React.useState<Product[]>([]);
  const [shift, setShift] = React.useState<Shift | null>(null);
  const [loading, setLoading] = React.useState(true);

  const userId = profile?.id;
  const storeId = profile?.store_id;

  const range = React.useMemo(
    () => periodRange(period.preset, period.from, period.to),
    [period],
  );

  React.useEffect(() => {
    if (appLoading || !storeId || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const [rep, cmp, low, sh] = await Promise.all([
          dashboardReport(range.from, range.to, sim),
          compareReport(range.from, range.to, sim),
          listLowStock(sim),
          getOpenShift(userId),
        ]);
        if (cancelled) return;
        setReport(rep);
        setCompare(cmp);
        setLowStock(low);
        setShift(sh);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat dashboard", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appLoading, userId, storeId, range, sim, toast]);

  if (appLoading || (loading && !report)) return <LoadingBlock />;

  const prefix = store?.currency_prefix ?? "Rp";
  const kosong = report ? num(report.jumlah_transaksi) === 0 && num(report.pengeluaran) === 0 : true;

  return (
    <>
      <PageHeader
        title={`Halo, ${profile?.name?.split(" ")[0] ?? "Kawan"} 👋`}
        description={
          isAdmin
            ? "Ringkasan performa toko kamu."
            : "Ringkasan penjualan dari shift dan transaksi kamu sendiri."
        }
        action={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      {/* Status shift */}
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${shift ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
          >
            <ClipboardList className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {shift ? "Shift kamu sedang berjalan" : "Belum ada shift terbuka"}
            </p>
            <p className="text-xs text-slate-500">
              {shift
                ? `Dibuka ${jam(shift.opened_at)} • Modal awal ${rupiah(shift.opening_cash, prefix)}`
                : "Buka shift dulu sebelum mulai melayani transaksi."}
            </p>
          </div>
        </div>
        <Link href={shift ? "/kasir" : "/shift"}>
          <Button variant={shift ? "primary" : "secondary"}>
            {shift ? "Lanjut ke kasir" : "Buka shift"}
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </Card>

      {/* Kartu ringkasan */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Omzet"
          value={rupiah(report?.omzet, prefix)}
          hint={`${num(report?.jumlah_transaksi)} transaksi`}
          tone="green"
          icon={TrendingUp}
          compare={
            compare && { now: num(compare.sekarang.omzet), prev: num(compare.sebelumnya.omzet) }
          }
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
          label="Rata-rata transaksi"
          value={rupiah(report?.rata_transaksi, prefix)}
          hint="Nilai belanja per struk"
          tone="blue"
          icon={Receipt}
        />
      </div>

      {/* Peringatan stok menipis */}
      {lowStock.length > 0 && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-900">
              {lowStock.length} produk stoknya menipis
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lowStock.slice(0, 5).map((p) => (
                <Badge key={p.id} tone="amber">
                  {p.name}: {p.stock}
                </Badge>
              ))}
              {lowStock.length > 5 && (
                <Badge tone="amber">+{lowStock.length - 5} lainnya</Badge>
              )}
            </div>
            {isAdmin && (
              <Link href="/produk" className="ml-auto">
                <Button size="sm" variant="outline">
                  Kelola stok
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {kosong ? (
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title="Belum ada data di periode ini"
            description="Mulai catat transaksi lewat menu Kasir, atau aktifkan mode simulasi untuk mencoba aplikasinya dulu."
            action={
              <div className="flex gap-2">
                <Link href="/kasir">
                  <Button>Buka kasir</Button>
                </Link>
                {isAdmin && (
                  <Link href="/pengaturan">
                    <Button variant="outline">Coba mode simulasi</Button>
                  </Link>
                )}
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Tren penjualan & pengeluaran"
            subtitle="Perbandingan uang masuk dan uang keluar per hari"
            className="lg:col-span-2"
          >
            <TrendChart data={report?.tren ?? []} />
          </SectionCard>

          <SectionCard title="Produk terlaris" subtitle="Berdasarkan jumlah terjual">
            {report?.produk_terlaris.length ? (
              <TopProductsChart data={report.produk_terlaris} />
            ) : (
              <EmptyState title="Belum ada penjualan produk" />
            )}
          </SectionCard>

          <SectionCard title="Jam ramai" subtitle="Sebaran transaksi sepanjang hari">
            <HourlyChart data={report?.per_jam ?? []} />
          </SectionCard>

          <SectionCard title="Metode pembayaran" subtitle="Komposisi omzet per metode">
            {report?.metode_bayar.length ? (
              <DonutChart
                data={report.metode_bayar.map((m) => ({
                  name: PAYMENT_METHOD_LABEL[m.metode] ?? m.metode,
                  value: num(m.total),
                }))}
              />
            ) : (
              <EmptyState title="Belum ada transaksi" />
            )}
          </SectionCard>

          <SectionCard title="Pengeluaran per kategori" subtitle="Ke mana uang toko pergi">
            {report?.kategori_pengeluaran.length ? (
              <DonutChart
                data={report.kategori_pengeluaran.map((c) => ({
                  name: c.kategori,
                  value: num(c.total),
                  color: c.warna,
                }))}
              />
            ) : (
              <EmptyState title="Belum ada pengeluaran tercatat" />
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}
