"use client";

import * as React from "react";
import { ClipboardList, Lock, Play, Wallet } from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  closeShift,
  getOpenShift,
  getShiftReport,
  listShifts,
  openShift,
} from "@/lib/services/sales";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Textarea,
  useToast,
  cx,
} from "@/components/ui";
import { PageHeader } from "@/components/app-shell";
import { SectionCard } from "@/components/report-bits";
import { exportShiftPdf } from "@/lib/pdf";
import { PAYMENT_METHOD_LABEL, type Shift, type ShiftReport } from "@/lib/types";
import { jam, num, rupiah, tanggalJam } from "@/lib/format";

export default function ShiftPage() {
  const { profile, store, isAdmin, sim, loading: appLoading } = useApp();
  const toast = useToast();

  const [current, setCurrent] = React.useState<Shift | null>(null);
  const [report, setReport] = React.useState<ShiftReport | null>(null);
  const [history, setHistory] = React.useState<Shift[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [opening, setOpening] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<ShiftReport | null>(null);

  const prefix = store?.currency_prefix ?? "Rp";
  const userId = profile?.id;

  // `tick` dinaikkan dari event handler untuk memaksa muat ulang, sehingga
  // seluruh pembaruan state terjadi di dalam efek setelah await.
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (appLoading || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const [sh, list] = await Promise.all([getOpenShift(userId), listShifts(sim)]);
        const rep = sh ? await getShiftReport(sh.id) : null;
        if (cancelled) return;
        setCurrent(sh);
        setHistory(list);
        setReport(rep);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat shift", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appLoading, userId, sim, tick, toast]);

  async function onOpen(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await openShift(Number(opening) || 0);
      setOpening("");
      toast("Shift dibuka. Selamat bertugas!", "success");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal membuka shift", "error");
    } finally {
      setSaving(false);
    }
  }

  if (appLoading || loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Shift kasir"
        description="Catat modal awal saat buka, dan cocokkan kas fisik saat tutup."
      />

      {current ? (
        <ActiveShift
          shift={current}
          report={report}
          prefix={prefix}
          onClose={() => setCloseOpen(true)}
          onRefresh={reload}
        />
      ) : (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
              <Play className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Buka shift baru</h2>
              <p className="text-sm text-slate-500">
                Hitung uang di laci sekarang, lalu masukkan sebagai modal awal.
              </p>
            </div>
          </div>

          <form onSubmit={onOpen} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Field label="Modal awal kas" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  placeholder="0"
                  className="text-lg font-semibold"
                  required
                />
              </Field>
            </div>
            <Button type="submit" size="lg" loading={saving}>
              Buka shift
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {[100000, 200000, 500000].map((v) => (
              <Button key={v} size="sm" variant="outline" onClick={() => setOpening(String(v))}>
                {rupiah(v, prefix)}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <SectionCard
        title={isAdmin ? "Riwayat shift semua kasir" : "Riwayat shift kamu"}
        subtitle="Klik satu baris untuk melihat rincian dan mengunduh laporan PDF"
      >
        {history.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Belum ada riwayat shift" />
        ) : (
          <div className="overflow-x-auto px-2">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Kasir</th>
                  <th className="px-3 py-2 font-medium">Dibuka</th>
                  <th className="px-3 py-2 font-medium">Ditutup</th>
                  <th className="px-3 py-2 text-right font-medium">Modal awal</th>
                  <th className="px-3 py-2 text-right font-medium">Kas seharusnya</th>
                  <th className="px-3 py-2 text-right font-medium">Kas fisik</th>
                  <th className="px-3 py-2 text-right font-medium">Selisih</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => {
                  const diff = num(s.difference);
                  return (
                    <tr
                      key={s.id}
                      onClick={async () => {
                        try {
                          setDetail(await getShiftReport(s.id));
                        } catch (err) {
                          toast(err instanceof Error ? err.message : "Gagal memuat", "error");
                        }
                      }}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {s.user?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{tanggalJam(s.opened_at)}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {s.closed_at ? tanggalJam(s.closed_at) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {rupiah(s.opening_cash, prefix)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {s.expected_cash === null ? "—" : rupiah(s.expected_cash, prefix)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {s.closing_cash === null ? "—" : rupiah(s.closing_cash, prefix)}
                      </td>
                      <td
                        className={cx(
                          "px-3 py-2.5 text-right font-medium tabular-nums",
                          s.difference === null
                            ? "text-slate-400"
                            : diff === 0
                              ? "text-slate-600"
                              : diff > 0
                                ? "text-emerald-600"
                                : "text-red-600",
                        )}
                      >
                        {s.difference === null
                          ? "—"
                          : `${diff > 0 ? "+" : ""}${rupiah(diff, prefix)}`}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={s.status === "open" ? "green" : "slate"}>
                          {s.status === "open" ? "Berjalan" : "Ditutup"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {closeOpen && current && (
        <CloseShiftModal
        onClose={() => setCloseOpen(false)}
        shift={current}
        report={report}
        prefix={prefix}
        onDone={() => {
          setCloseOpen(false);
          toast("Shift ditutup", "success");
          reload();
        }}
        />
      )}

      <ShiftDetailModal
        report={detail}
        prefix={prefix}
        storeName={store?.name ?? "Warkas"}
        onClose={() => setDetail(null)}
      />
    </>
  );
}

function ActiveShift({
  shift,
  report,
  prefix,
  onClose,
  onRefresh,
}: {
  shift: Shift;
  report: ShiftReport | null;
  prefix: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-emerald-50 px-5 py-3">
        <div className="flex items-center gap-2 text-emerald-800">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-semibold">Shift berjalan sejak {jam(shift.opened_at)}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            Muat ulang
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            <Lock className="size-4" /> Tutup shift
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-slate-200 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Stat label="Modal awal" value={rupiah(shift.opening_cash, prefix)} />
        <Stat label="Omzet" value={rupiah(report?.omzet, prefix)} />
        <Stat
          label="Transaksi"
          value={String(num(report?.jumlah_transaksi))}
          suffix="struk"
        />
        <Stat label="Laba kotor" value={rupiah(report?.laba_kotor, prefix)} />
        <Stat label="Pengeluaran" value={rupiah(report?.pengeluaran_total, prefix)} />
        <Stat
          label="Kas seharusnya"
          value={rupiah(report?.kas_seharusnya, prefix)}
          highlight
        />
      </dl>
    </Card>
  );
}

function Stat({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cx("px-5 py-4", highlight && "bg-slate-50")}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={cx(
          "mt-1 text-lg font-bold tabular-nums",
          highlight ? "text-brand-700" : "text-slate-900",
        )}
      >
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-slate-400">{suffix}</span>}
      </dd>
    </div>
  );
}

function CloseShiftModal({
  onClose,
  shift,
  report,
  prefix,
  onDone,
}: {
  onClose: () => void;
  shift: Shift;
  report: ShiftReport | null;
  prefix: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [cash, setCash] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const expected = num(report?.kas_seharusnya);
  const actual = Number(cash) || 0;
  const diff = actual - expected;
  const terisi = cash.trim() !== "";

  return (
    <Modal
      open
      onClose={onClose}
      title="Tutup shift"
      description="Hitung uang fisik di laci, lalu masukkan jumlahnya."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="secondary"
            loading={saving}
            disabled={!terisi}
            onClick={async () => {
              setSaving(true);
              try {
                await closeShift(shift.id, actual, note || undefined);
                onDone();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Gagal menutup shift", "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            Tutup shift
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm">
          <Row label="Modal awal" value={rupiah(shift.opening_cash, prefix)} />
          <Row label="Penjualan tunai" value={rupiah(report?.penjualan_tunai, prefix)} />
          <Row
            label="Pengeluaran tunai"
            value={`−${rupiah(report?.pengeluaran_tunai, prefix)}`}
          />
          <div className="mt-2 border-t border-slate-200 pt-2">
            <Row
              label="Kas seharusnya"
              value={rupiah(expected, prefix)}
              strong
            />
          </div>
        </div>

        <Field label="Kas fisik di laci" required>
          <Input
            type="number"
            inputMode="numeric"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            placeholder="0"
            className="text-lg font-semibold"
            autoFocus
          />
        </Field>

        {terisi && (
          <div
            className={cx(
              "flex items-center justify-between rounded-xl px-4 py-3",
              diff === 0 ? "bg-emerald-50" : diff > 0 ? "bg-sky-50" : "bg-red-50",
            )}
          >
            <span
              className={cx(
                "text-sm font-medium",
                diff === 0 ? "text-emerald-700" : diff > 0 ? "text-sky-700" : "text-red-700",
              )}
            >
              {diff === 0 ? "Kas cocok 🎉" : diff > 0 ? "Kas lebih" : "Kas kurang"}
            </span>
            <span
              className={cx(
                "text-lg font-bold tabular-nums",
                diff === 0 ? "text-emerald-700" : diff > 0 ? "text-sky-700" : "text-red-700",
              )}
            >
              {diff > 0 ? "+" : ""}
              {rupiah(diff, prefix)}
            </span>
          </div>
        )}

        <Field label="Catatan" hint="Misalnya penyebab selisih kas">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={cx(strong ? "font-medium text-slate-900" : "text-slate-600")}>{label}</span>
      <span
        className={cx(
          "tabular-nums",
          strong ? "text-base font-bold text-slate-900" : "text-slate-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ShiftDetailModal({
  report,
  prefix,
  storeName,
  onClose,
}: {
  report: ShiftReport | null;
  prefix: string;
  storeName: string;
  onClose: () => void;
}) {
  if (!report) return null;
  const s = report.shift;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Shift ${report.kasir}`}
      description={`${tanggalJam(s.opened_at)} — ${s.closed_at ? tanggalJam(s.closed_at) : "berjalan"}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={() => exportShiftPdf(report, storeName, prefix)}>
            <Wallet className="size-4" /> Unduh PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Box label="Omzet" value={rupiah(report.omzet, prefix)} />
          <Box label="Transaksi" value={`${num(report.jumlah_transaksi)} struk`} />
          <Box label="Modal barang (HPP)" value={rupiah(report.hpp, prefix)} />
          <Box label="Laba kotor" value={rupiah(report.laba_kotor, prefix)} />
          <Box label="Penjualan tunai" value={rupiah(report.penjualan_tunai, prefix)} />
          <Box label="Pengeluaran" value={rupiah(report.pengeluaran_total, prefix)} />
          <Box label="Kas seharusnya" value={rupiah(report.kas_seharusnya, prefix)} />
          <Box
            label="Kas fisik"
            value={s.closing_cash === null ? "—" : rupiah(s.closing_cash, prefix)}
          />
        </div>

        {s.difference !== null && (
          <div
            className={cx(
              "rounded-xl px-4 py-3 font-medium",
              num(s.difference) === 0
                ? "bg-emerald-50 text-emerald-700"
                : num(s.difference) > 0
                  ? "bg-sky-50 text-sky-700"
                  : "bg-red-50 text-red-700",
            )}
          >
            Selisih kas: {num(s.difference) > 0 ? "+" : ""}
            {rupiah(s.difference, prefix)}
          </div>
        )}

        {report.metode_bayar.length > 0 && (
          <div>
            <p className="mb-2 font-medium text-slate-900">Metode pembayaran</p>
            <ul className="space-y-1">
              {report.metode_bayar.map((m) => (
                <li key={m.metode} className="flex justify-between text-slate-600">
                  <span>
                    {PAYMENT_METHOD_LABEL[m.metode] ?? m.metode}{" "}
                    <span className="text-slate-400">({m.jumlah})</span>
                  </span>
                  <span className="tabular-nums">{rupiah(m.total, prefix)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.produk.length > 0 && (
          <div>
            <p className="mb-2 font-medium text-slate-900">Produk terjual</p>
            <ul className="space-y-1">
              {report.produk.slice(0, 15).map((p) => (
                <li key={p.nama} className="flex justify-between gap-3 text-slate-600">
                  <span className="min-w-0 truncate">
                    {p.nama} <span className="text-slate-400">×{p.qty}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {rupiah(p.omzet, prefix)}
                    <span className="ml-2 text-emerald-600">+{rupiah(p.laba, prefix)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.note && (
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Catatan</p>
            <p className="mt-1 text-slate-700">{s.note}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
