"use client";

import * as React from "react";
import {
  Check,
  Clock,
  Download,
  ImagePlus,
  Plus,
  Receipt,
  Repeat,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { listExpenseCategories, signedReceiptUrl, uploadImage } from "@/lib/services/catalog";
import {
  createExpense,
  deleteExpense,
  deleteRecurring,
  listExpenses,
  listRecurring,
  postRecurring,
  reviewExpense,
  saveRecurring,
} from "@/lib/services/expenses";
import { getOpenShift } from "@/lib/services/sales";
import {
  Badge,
  Button,
  Card,
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
import { PageHeader } from "@/components/app-shell";
import { PeriodFilter, StatCard, type PeriodState } from "@/components/report-bits";
import { exportExpensesPdf } from "@/lib/pdf";
import type { Expense, ExpenseCategory, PaymentSource, RecurringExpense, Shift } from "@/lib/types";
import { isoDate, num, periodRange, rupiah, tanggal } from "@/lib/format";

export default function PengeluaranPage() {
  const { profile, store, isAdmin, sim, loading: appLoading } = useApp();
  const toast = useToast();

  const [period, setPeriod] = React.useState<PeriodState>({
    preset: "bulan-ini",
    from: isoDate(new Date()),
    to: isoDate(new Date()),
  });
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [recurring, setRecurring] = React.useState<RecurringExpense[]>([]);
  const [shift, setShift] = React.useState<Shift | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [recurringOpen, setRecurringOpen] = React.useState(false);

  const prefix = store?.currency_prefix ?? "Rp";
  const userId = profile?.id;
  const range = React.useMemo(() => periodRange(period.preset, period.from, period.to), [period]);
  const fromDate = isoDate(range.from);
  const toDate = isoDate(new Date(range.to.getTime() - 1));

  // `tick` dinaikkan dari event handler untuk memaksa muat ulang, sehingga
  // seluruh pembaruan state terjadi di dalam efek setelah await.
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (appLoading || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const [list, cats, sh] = await Promise.all([
          listExpenses(sim, { from: fromDate, to: toDate }),
          listExpenseCategories(sim),
          getOpenShift(userId),
        ]);
        const rec = isAdmin ? await listRecurring() : [];
        if (cancelled) return;
        setExpenses(list);
        setCategories(cats);
        setShift(sh);
        setRecurring(rec);
      } catch (err) {
        if (!cancelled) {
          toast(err instanceof Error ? err.message : "Gagal memuat pengeluaran", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appLoading, userId, sim, fromDate, toDate, isAdmin, toast, tick]);

  const total = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + num(e.amount), 0);
  const pending = expenses.filter((e) => e.status === "pending");
  const tunai = expenses
    .filter((e) => e.status === "approved" && e.payment_source === "cash")
    .reduce((s, e) => s + num(e.amount), 0);

  if (appLoading || loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Pengeluaran"
        description="Catat semua uang keluar supaya laba bersih akurat."
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => setRecurringOpen(true)}>
                <Repeat className="size-4" /> Rutin
                {recurring.filter((r) => r.is_active && r.next_due_date <= isoDate(new Date()))
                  .length > 0 && (
                  <Badge tone="amber">
                    {
                      recurring.filter(
                        (r) => r.is_active && r.next_due_date <= isoDate(new Date()),
                      ).length
                    }
                  </Badge>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!expenses.length}
              onClick={() =>
                exportExpensesPdf(expenses, {
                  storeName: store?.name ?? "Warkas",
                  from: fromDate,
                  to: toDate,
                  prefix,
                })
              }
            >
              <Download className="size-4" /> PDF
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" /> Catat pengeluaran
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total pengeluaran"
          value={rupiah(total, prefix)}
          hint={`${expenses.filter((e) => e.status === "approved").length} catatan`}
          tone="amber"
          icon={Wallet}
        />
        <StatCard
          label="Dibayar tunai"
          value={rupiah(tunai, prefix)}
          hint="Mengurangi kas laci"
          tone="slate"
          icon={Receipt}
        />
        <StatCard
          label="Menunggu approval"
          value={String(pending.length)}
          hint={pending.length ? rupiah(pending.reduce((s, e) => s + num(e.amount), 0), prefix) : "Tidak ada"}
          tone={pending.length ? "red" : "slate"}
          icon={Clock}
        />
      </div>

      {expenses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Belum ada pengeluaran di periode ini"
            description="Catat belanja bahan baku, bayar listrik, gaji, dan lainnya di sini."
            action={<Button onClick={() => setFormOpen(true)}>Catat pengeluaran</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Tanggal</th>
                  <th className="px-4 py-2.5 font-medium">Kategori</th>
                  <th className="px-4 py-2.5 font-medium">Catatan</th>
                  <th className="px-4 py-2.5 font-medium">Oleh</th>
                  <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {tanggal(e.expense_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: e.category?.color ?? "#94a3b8" }}
                        />
                        {e.category?.name ?? "Tanpa kategori"}
                      </span>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 text-slate-600">
                      {e.note ?? "—"}
                      {e.receipt_url && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              window.open(await signedReceiptUrl(e.receipt_url!), "_blank");
                            } catch {
                              toast("Gagal membuka foto struk", "error");
                            }
                          }}
                          className="ml-2 text-xs font-medium text-brand-700 hover:underline"
                        >
                          lihat struk
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.user?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                      {rupiah(e.amount, prefix)}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        {e.payment_source === "cash" ? "tunai" : "non-tunai"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          e.status === "approved" ? "green" : e.status === "pending" ? "amber" : "red"
                        }
                      >
                        {e.status === "approved"
                          ? "Disetujui"
                          : e.status === "pending"
                            ? "Menunggu"
                            : "Ditolak"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isAdmin && e.status === "pending" && (
                          <>
                            <button
                              type="button"
                              aria-label="Setujui"
                              onClick={async () => {
                                await reviewExpense(e.id, true);
                                toast("Pengeluaran disetujui", "success");
                                reload();
                              }}
                              className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                            >
                              <Check className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Tolak"
                              onClick={async () => {
                                await reviewExpense(e.id, false);
                                toast("Pengeluaran ditolak", "info");
                                reload();
                              }}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            >
                              <X className="size-4" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          aria-label="Hapus"
                          onClick={async () => {
                            if (!confirm("Hapus catatan pengeluaran ini?")) return;
                            try {
                              await deleteExpense(e.id);
                              toast("Pengeluaran dihapus", "success");
                              reload();
                            } catch (err) {
                              toast(
                                err instanceof Error ? err.message : "Gagal menghapus",
                                "error",
                              );
                            }
                          }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {formOpen && (
        <ExpenseModal
        onClose={() => setFormOpen(false)}
        categories={categories}
        shift={shift}
        storeId={store?.id ?? ""}
        limit={num(store?.cashier_expense_limit)}
        isAdmin={isAdmin}
        prefix={prefix}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
        />
      )}

      {isAdmin && recurringOpen && (
        <RecurringModal
          onClose={() => setRecurringOpen(false)}
          items={recurring}
          categories={categories}
          storeId={store?.id ?? ""}
          prefix={prefix}
          onChanged={reload}
        />
      )}
    </>
  );
}

function ExpenseModal({
  onClose,
  categories,
  shift,
  storeId,
  limit,
  isAdmin,
  prefix,
  onSaved,
}: {
  onClose: () => void;
  categories: ExpenseCategory[];
  shift: Shift | null;
  storeId: string;
  limit: number;
  isAdmin: boolean;
  prefix: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(() => categories[0]?.id ?? "");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState(() => isoDate(new Date()));
  const [source, setSource] = React.useState<PaymentSource>("cash");
  const [receipt, setReceipt] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const nominal = Number(amount) || 0;
  const perluApproval = !isAdmin && nominal > limit;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nominal <= 0) return;

    setSaving(true);
    try {
      await createExpense({
        amount: nominal,
        categoryId: categoryId || null,
        note,
        expenseDate: date,
        shiftId: source === "cash" ? shift?.id ?? null : null,
        receiptUrl: receipt,
        paymentSource: source,
      });
      toast(
        perluApproval
          ? "Pengeluaran dicatat, menunggu persetujuan admin"
          : "Pengeluaran dicatat",
        "success",
      );
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan pengeluaran", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Catat pengeluaran"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={(e) => void submit(e)} loading={saving} disabled={nominal <= 0}>
            Simpan
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nominal" required>
          <Input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="text-lg font-semibold"
            required
            autoFocus
          />
        </Field>

        {perluApproval && (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            Nominal di atas limit kasir ({rupiah(limit, prefix)}). Pengeluaran ini akan menunggu
            persetujuan admin sebelum masuk laporan.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategori" required>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Pilih kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tanggal" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>

        <Field
          label="Sumber dana"
          hint="Tunai mengurangi kas laci dan ikut dihitung saat tutup shift."
        >
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "non_cash"] as PaymentSource[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={cx(
                  "rounded-xl border px-3 py-2.5 text-sm font-medium",
                  source === s
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {s === "cash" ? "Kas laci (tunai)" : "Transfer / non-tunai"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Catatan" hint="Misalnya: beli 5 kg beras di Pasar Baru">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>

        <Field label="Foto struk" hint="Opsional, tersimpan aman dan hanya bisa dibuka admin">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <ImagePlus className="size-4" />
            {uploading ? "Mengunggah…" : receipt ? "Struk terunggah — ganti" : "Unggah foto struk"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  setReceipt(await uploadImage("receipts", file, storeId));
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Gagal unggah struk", "error");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </Field>
      </form>
    </Modal>
  );
}

function RecurringModal({
  onClose,
  items,
  categories,
  storeId,
  prefix,
  onChanged,
}: {
  onClose: () => void;
  items: RecurringExpense[];
  categories: ExpenseCategory[];
  storeId: string;
  prefix: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = React.useState<Partial<RecurringExpense>>({ frequency: "monthly" });
  const [saving, setSaving] = React.useState(false);
  const today = isoDate(new Date());

  return (
    <Modal
      open
      onClose={onClose}
      title="Pengeluaran rutin"
      description="Jadwalkan biaya berulang seperti sewa atau langganan, lalu catat sekali klik saat jatuh tempo."
      size="lg"
    >
      <div className="space-y-5">
        {items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {items.map((r) => {
              const jatuhTempo = r.next_due_date <= today;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {rupiah(r.amount, prefix)} • {r.frequency === "monthly" ? "bulanan" : "mingguan"}{" "}
                      • jatuh tempo {tanggal(r.next_due_date)}
                    </p>
                  </div>
                  {jatuhTempo && <Badge tone="amber">Jatuh tempo</Badge>}
                  <Button
                    size="sm"
                    variant={jatuhTempo ? "primary" : "outline"}
                    onClick={async () => {
                      try {
                        await postRecurring(r);
                        toast("Pengeluaran rutin dicatat", "success");
                        onChanged();
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Gagal mencatat", "error");
                      }
                    }}
                  >
                    Catat sekarang
                  </Button>
                  <button
                    type="button"
                    aria-label={`Hapus ${r.name}`}
                    onClick={async () => {
                      if (!confirm(`Hapus jadwal "${r.name}"?`)) return;
                      await deleteRecurring(r.id);
                      onChanged();
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-900">Tambah jadwal baru</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama" required>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Sewa kios"
              />
            </Field>
            <Field label="Nominal" required>
              <Input
                type="number"
                inputMode="numeric"
                value={form.amount ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Kategori">
              <Select
                value={form.category_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value || null }))}
              >
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Frekuensi">
              <Select
                value={form.frequency ?? "monthly"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, frequency: e.target.value as RecurringExpense["frequency"] }))
                }
              >
                <option value="monthly">Bulanan</option>
                <option value="weekly">Mingguan</option>
              </Select>
            </Field>
            <Field label="Jatuh tempo berikutnya" required>
              <Input
                type="date"
                value={form.next_due_date ?? today}
                onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
              />
            </Field>
          </div>

          <Button
            className="mt-3"
            loading={saving}
            disabled={!form.name?.trim() || !form.amount}
            onClick={async () => {
              setSaving(true);
              try {
                await saveRecurring(
                  { ...form, name: form.name!, amount: Number(form.amount) },
                  storeId,
                );
                setForm({ frequency: "monthly" });
                toast("Jadwal ditambahkan", "success");
                onChanged();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Gagal menyimpan", "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            <Plus className="size-4" /> Tambah jadwal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
