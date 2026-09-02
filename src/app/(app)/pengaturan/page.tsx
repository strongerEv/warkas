"use client";

import * as React from "react";
import {
  AlertTriangle,
  Database,
  FileDown,
  FlaskConical,
  History,
  Save,
  Sparkles,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  generateSimulationData,
  resetData,
  setSimulationMode,
  updateStore,
} from "@/lib/services/admin";
import { listActivityLogs } from "@/lib/services/reports";
import { listExpenses } from "@/lib/services/expenses";
import { listTransactions } from "@/lib/services/sales";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Select,
  Textarea,
  useToast,
  cx,
} from "@/components/ui";
import { AdminOnly, PageHeader } from "@/components/app-shell";
import { exportBackupCsv } from "@/lib/pdf";
import type { ActivityLog, ResetType, Store } from "@/lib/types";
import { tanggalJam } from "@/lib/format";

const RESET_INFO: Record<
  ResetType,
  { title: string; description: string; danger: string; tone: "amber" | "red" }
> = {
  simulation: {
    title: "Reset data simulasi",
    description:
      "Menghapus semua data bertanda simulasi: produk contoh, transaksi, pengeluaran, dan shift sandbox.",
    danger: "Data asli toko sama sekali tidak tersentuh.",
    tone: "amber",
  },
  transactional: {
    title: "Reset total pembukuan",
    description:
      "Menghapus semua transaksi, pengeluaran, shift, dan riwayat stok — baik asli maupun simulasi.",
    danger: "Produk, kategori, dan akun pengguna tetap aman. Cocok saat mulai tahun buku baru.",
    tone: "red",
  },
  factory: {
    title: "Reset pabrik",
    description:
      "Menghapus SEMUA data termasuk produk, kategori, dan akun kasir. Hanya akun admin kamu yang tersisa.",
    danger: "Tindakan ini tidak bisa dibatalkan. Gunakan hanya saat toko berpindah tangan.",
    tone: "red",
  },
};

export default function PengaturanPage() {
  return (
    <AdminOnly>
      <PengaturanInner />
    </AdminOnly>
  );
}

function PengaturanInner() {
  const { store, sim, refresh, loading: appLoading } = useApp();
  const toast = useToast();

  const [toggling, setToggling] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [days, setDays] = React.useState("30");
  const [resetType, setResetType] = React.useState<ResetType | null>(null);
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [logsOpen, setLogsOpen] = React.useState(false);

  if (appLoading || !store) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Identitas toko, mode simulasi, dan kontrol data."
        action={
          <Button
            variant="outline"
            onClick={async () => {
              setLogs(await listActivityLogs());
              setLogsOpen(true);
            }}
          >
            <History className="size-4" /> Log aktivitas
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <StoreProfileCard key={store.id} store={store} onSaved={refresh} />

        {/* ---------- Mode simulasi ---------- */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <FlaskConical className="size-4 text-slate-400" /> Mode simulasi
              </span>
            }
            subtitle="Sandbox untuk demo, training kasir, dan uji coba laporan"
            action={sim ? <Badge tone="amber">Aktif</Badge> : <Badge>Nonaktif</Badge>}
          />
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">
              Saat mode simulasi aktif, semua shift, transaksi, dan pengeluaran yang dibuat ditandai
              sebagai data simulasi dan <strong>tidak pernah masuk ke laporan asli</strong>. Kasir
              juga hanya bisa menjual produk simulasi, jadi stok produk asli tidak akan terpotong.
            </p>

            <Button
              variant={sim ? "secondary" : "primary"}
              loading={toggling}
              onClick={async () => {
                setToggling(true);
                try {
                  await setSimulationMode(!sim);
                  await refresh();
                  toast(sim ? "Mode simulasi dimatikan" : "Mode simulasi diaktifkan", "success");
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Gagal mengubah mode", "error");
                } finally {
                  setToggling(false);
                }
              }}
            >
              {sim ? "Matikan mode simulasi" : "Aktifkan mode simulasi"}
            </Button>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="size-4 text-brand-600" /> Generator data dummy
              </p>
              <p className="mb-3 text-sm text-slate-600">
                Membuat katalog contoh, shift, transaksi acak dengan pola jam ramai realistis, dan
                pengeluaran di berbagai kategori.
              </p>

              <div className="flex flex-wrap items-end gap-2">
                <Field label="Rentang">
                  <Select
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="w-auto"
                  >
                    <option value="7">7 hari terakhir</option>
                    <option value="30">30 hari terakhir</option>
                    <option value="90">90 hari terakhir</option>
                  </Select>
                </Field>
                <Button
                  variant="outline"
                  loading={generating}
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      const result = await generateSimulationData(Number(days));
                      toast(
                        `Selesai: ${result.transaksi} transaksi, ${result.pengeluaran} pengeluaran, ${result.shift} shift`,
                        "success",
                      );
                      if (!sim) {
                        await setSimulationMode(true);
                        await refresh();
                      }
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Gagal membuat data", "error");
                    } finally {
                      setGenerating(false);
                    }
                  }}
                >
                  <Database className="size-4" /> Generate data simulasi
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* ---------- Reset data ---------- */}
        <Card className="border-red-200 lg:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="size-4" /> Zona berbahaya
              </span>
            }
            subtitle="Semua reset wajib konfirmasi ganda dan tercatat di log aktivitas"
          />
          <div className="grid gap-3 p-5 md:grid-cols-3">
            {(Object.keys(RESET_INFO) as ResetType[]).map((type) => {
              const info = RESET_INFO[type];
              return (
                <div
                  key={type}
                  className={cx(
                    "flex flex-col rounded-xl border p-4",
                    info.tone === "red" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50",
                  )}
                >
                  <p className="font-semibold text-slate-900">{info.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{info.description}</p>
                  <p
                    className={cx(
                      "mt-2 text-xs font-medium",
                      info.tone === "red" ? "text-red-700" : "text-amber-800",
                    )}
                  >
                    {info.danger}
                  </p>
                  <Button
                    variant={info.tone === "red" ? "danger" : "outline"}
                    size="sm"
                    className="mt-4"
                    onClick={() => setResetType(type)}
                  >
                    <Trash2 className="size-4" /> Jalankan
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {resetType && (
        <ResetModal
          key={resetType}
          type={resetType}
          storeName={store.name}
          sim={sim}
          onClose={() => setResetType(null)}
          onDone={() => {
            setResetType(null);
            void refresh();
          }}
        />
      )}

      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title="Log aktivitas" size="lg">
        {logs.length === 0 ? (
          <EmptyState icon={History} title="Belum ada aktivitas tercatat" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{l.description}</p>
                    <p className="text-xs text-slate-500">
                      {l.user?.name ?? "Sistem"} • {tanggalJam(l.created_at)}
                    </p>
                  </div>
                  <Badge>{l.action_type}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function StoreProfileCard({
  store,
  onSaved,
}: {
  store: Store;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [form, setForm] = React.useState(() => ({
    name: store.name,
    address: store.address ?? "",
    phone: store.phone ?? "",
    receipt_footer: store.receipt_footer ?? "",
    cashier_expense_limit: Number(store.cashier_expense_limit),
  }));
  const [saving, setSaving] = React.useState(false);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <StoreIcon className="size-4 text-slate-400" /> Profil toko
          </span>
        }
        subtitle="Muncul di struk dan laporan PDF"
      />
      <div className="space-y-4 p-5">
        <Field label="Nama toko" required>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>

        <Field label="Alamat">
          <Textarea
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            rows={2}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor telepon">
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="0812…"
            />
          </Field>

          <Field
            label="Limit pengeluaran kasir"
            hint="Di atas nominal ini perlu approval admin"
          >
            <Input
              type="number"
              inputMode="numeric"
              value={form.cashier_expense_limit}
              onChange={(e) =>
                setForm((f) => ({ ...f, cashier_expense_limit: Number(e.target.value) }))
              }
            />
          </Field>
        </div>

        <Field label="Teks penutup struk">
          <Input
            value={form.receipt_footer}
            onChange={(e) => setForm((f) => ({ ...f, receipt_footer: e.target.value }))}
            placeholder="Terima kasih telah berbelanja"
          />
        </Field>

        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await updateStore(store.id, form);
              await onSaved();
              toast("Pengaturan toko disimpan", "success");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Gagal menyimpan", "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          <Save className="size-4" /> Simpan
        </Button>
      </div>
    </Card>
  );
}

function ResetModal({
  type,
  storeName,
  sim,
  onClose,
  onDone,
}: {
  type: ResetType;
  storeName: string;
  sim: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [confirmation, setConfirmation] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [backingUp, setBackingUp] = React.useState(false);
  const [backedUp, setBackedUp] = React.useState(false);

  const info = RESET_INFO[type];
  const cocok =
    confirmation.trim().toUpperCase() === "HAPUS" ||
    confirmation.trim().toLowerCase() === storeName.toLowerCase();

  async function backup() {
    setBackingUp(true);
    try {
      // Cadangkan data simulasi maupun asli sesuai jenis reset yang dipilih.
      const scopes = type === "simulation" ? [true] : [true, false];

      for (const scope of scopes) {
        const [trx, exp] = await Promise.all([
          listTransactions(scope, { limit: 10000 }),
          listExpenses(scope, { limit: 10000 }),
        ]);
        const suffix = scope ? "simulasi" : "asli";

        if (trx.length) {
          exportBackupCsv(
            trx.map((t) => ({
              kode: t.code,
              waktu: t.created_at,
              kasir: t.user?.name ?? "",
              metode: t.payment_method,
              subtotal: t.subtotal,
              diskon: t.discount,
              total: t.total,
              item: (t.items ?? [])
                .map((i) => `${i.qty}x ${i.product_name}`)
                .join(" | "),
            })),
            `backup-transaksi-${suffix}.csv`,
          );
        }

        if (exp.length) {
          exportBackupCsv(
            exp.map((e) => ({
              tanggal: e.expense_date,
              kategori: e.category?.name ?? "",
              nominal: e.amount,
              sumber: e.payment_source,
              status: e.status,
              oleh: e.user?.name ?? "",
              catatan: e.note ?? "",
            })),
            `backup-pengeluaran-${suffix}.csv`,
          );
        }
      }

      setBackedUp(true);
      toast("Cadangan CSV diunduh", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal membuat cadangan", "error");
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={info.title}
      description={info.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="danger"
            loading={running}
            disabled={!cocok}
            onClick={async () => {
              setRunning(true);
              try {
                const result = await resetData(type, confirmation);
                const total = Object.values(result.terhapus).reduce(
                  (s, n) => s + Number(n || 0),
                  0,
                );
                toast(`Reset selesai. ${total} baris data dihapus.`, "success");
                onDone();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Reset gagal", "error");
              } finally {
                setRunning(false);
              }
            }}
          >
            Ya, hapus sekarang
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p
          className={cx(
            "rounded-xl px-4 py-3 text-sm font-medium",
            info.tone === "red" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900",
          )}
        >
          {info.danger}
        </p>

        {type !== "simulation" && sim && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Mode simulasi sedang aktif. Reset ini juga akan menghapus data asli, bukan hanya data
            sandbox.
          </p>
        )}

        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-900">
            Disarankan: unduh cadangan dulu
          </p>
          <p className="mt-1 text-sm text-slate-600">
            File CSV berisi transaksi dan pengeluaran akan diunduh ke perangkat kamu.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            loading={backingUp}
            onClick={() => void backup()}
          >
            <FileDown className="size-4" />
            {backedUp ? "Unduh ulang cadangan" : "Unduh cadangan CSV"}
          </Button>
        </div>

        <Field
          label={`Ketik "HAPUS" atau nama toko (${storeName}) untuk konfirmasi`}
          required
        >
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="HAPUS"
            autoFocus
            className="font-semibold"
          />
        </Field>

        {!backedUp && type !== "simulation" && (
          <p className="text-xs text-slate-500">
            Kamu masih bisa melanjutkan tanpa cadangan, tapi data yang dihapus tidak bisa
            dikembalikan dan tidak akan muncul lagi di laporan mana pun.
          </p>
        )}
      </div>
    </Modal>
  );
}
