"use client";

import * as React from "react";
import { Ban, Receipt, Search } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { getTransaction, listTransactions, voidTransaction } from "@/lib/services/sales";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  LoadingBlock,
  useToast,
} from "@/components/ui";
import { PageHeader } from "@/components/app-shell";
import { PeriodFilter, StatCard, type PeriodState } from "@/components/report-bits";
import { ReceiptModal } from "@/components/receipt";
import { PAYMENT_METHOD_LABEL, type Transaction } from "@/lib/types";
import { isoDate, jam, num, periodRange, rupiah, tanggal } from "@/lib/format";

export default function TransaksiPage() {
  const { store, profile, isAdmin, sim, loading: appLoading } = useApp();
  const toast = useToast();

  const [period, setPeriod] = React.useState<PeriodState>({
    preset: "hari-ini",
    from: isoDate(new Date()),
    to: isoDate(new Date()),
  });
  const [rows, setRows] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<Transaction | null>(null);

  const prefix = store?.currency_prefix ?? "Rp";
  const range = React.useMemo(() => periodRange(period.preset, period.from, period.to), [period]);

  // `tick` dinaikkan dari event handler untuk memaksa muat ulang, sehingga
  // seluruh pembaruan state terjadi di dalam efek setelah await.
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (appLoading) return;
    let cancelled = false;

    (async () => {
      try {
        const list = await listTransactions(sim, { from: range.from, to: range.to, limit: 300 });
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat transaksi", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appLoading, sim, range, tick, toast]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        (t.user?.name ?? "").toLowerCase().includes(q) ||
        (t.items ?? []).some((i) => i.product_name.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const omzet = filtered.reduce((s, t) => s + num(t.total), 0);

  if (appLoading || loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Transaksi"
        description={
          isAdmin ? "Semua struk penjualan toko." : "Riwayat struk dari transaksi kamu sendiri."
        }
        action={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Jumlah struk" value={String(filtered.length)} icon={Receipt} />
        <StatCard label="Total omzet" value={rupiah(omzet, prefix)} tone="green" />
        <StatCard
          label="Rata-rata"
          value={rupiah(filtered.length ? omzet / filtered.length : 0, prefix)}
          tone="blue"
        />
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor struk, kasir, produk…"
            className="pl-9"
            aria-label="Cari transaksi"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title={rows.length ? "Transaksi tidak ditemukan" : "Belum ada transaksi"}
            description={
              rows.length ? "Coba kata kunci lain." : "Transaksi dari menu Kasir akan muncul di sini."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Struk</th>
                  <th className="px-4 py-2.5 font-medium">Waktu</th>
                  <th className="px-4 py-2.5 font-medium">Kasir</th>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">Bayar</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={async () => setDetail((await getTransaction(t.id)) ?? t)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{t.code}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {tanggal(t.created_at)} · {jam(t.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.user?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(t.items ?? []).reduce((s, i) => s + i.qty, 0)} item
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={t.payment_method === "cash" ? "green" : "blue"}>
                        {PAYMENT_METHOD_LABEL[t.payment_method]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {rupiah(t.total, prefix)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          aria-label={`Batalkan ${t.code}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (
                              !confirm(
                                `Batalkan transaksi ${t.code}? Stok produk akan dikembalikan dan struk dihapus permanen.`,
                              )
                            )
                              return;
                            try {
                              await voidTransaction(t.id, "Dibatalkan admin");
                              toast("Transaksi dibatalkan, stok dikembalikan", "success");
                              reload();
                            } catch (err) {
                              toast(
                                err instanceof Error ? err.message : "Gagal membatalkan",
                                "error",
                              );
                            }
                          }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Ban className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ReceiptModal
        open={!!detail}
        onClose={() => setDetail(null)}
        transaction={detail}
        store={store}
        cashierName={detail?.user?.name ?? profile?.name}
      />
    </>
  );
}
