"use client";

import * as React from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  deleteCategory,
  deleteExpenseCategory,
  listCategories,
  listExpenseCategories,
  saveCategory,
  saveExpenseCategory,
} from "@/lib/services/catalog";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  useToast,
  cx,
} from "@/components/ui";
import { AdminOnly, PageHeader } from "@/components/app-shell";
import type { Category, ExpenseCategory } from "@/lib/types";

const PALETTE = [
  "#059669",
  "#0ea5e9",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#ec4899",
  "#64748b",
];

type Tab = "produk" | "pengeluaran";
type AnyCategory = (Category | ExpenseCategory) & { sort_order?: number };

export default function KategoriPage() {
  return (
    <AdminOnly>
      <KategoriInner />
    </AdminOnly>
  );
}

function KategoriInner() {
  const { store, sim } = useApp();
  const toast = useToast();

  const [tab, setTab] = React.useState<Tab>("produk");
  const [produk, setProduk] = React.useState<Category[]>([]);
  const [pengeluaran, setPengeluaran] = React.useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<Partial<AnyCategory> | null>(null);

  // `tick` dinaikkan dari event handler untuk memaksa muat ulang, sehingga
  // seluruh pembaruan state terjadi di dalam efek setelah await.
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [p, e] = await Promise.all([listCategories(sim), listExpenseCategories(sim)]);
        if (cancelled) return;
        setProduk(p);
        setPengeluaran(e);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat kategori", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sim, tick, toast]);

  if (loading) return <LoadingBlock />;

  const items: AnyCategory[] = tab === "produk" ? produk : pengeluaran;

  return (
    <>
      <PageHeader
        title="Kategori"
        description="Kelompokkan produk dan pengeluaran supaya laporan lebih mudah dibaca."
        action={
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> Kategori baru
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
        {(["produk", "pengeluaran"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cx(
              "rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            Kategori {t}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tags}
            title="Belum ada kategori"
            action={<Button onClick={() => setEditing({})}>Tambah kategori</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="flex items-center gap-3 p-4">
              <span
                className="size-9 shrink-0 rounded-xl"
                style={{ background: c.color }}
                aria-hidden
              />
              <p className="min-w-0 flex-1 truncate font-medium text-slate-900">{c.name}</p>
              <button
                type="button"
                onClick={() => setEditing(c)}
                aria-label={`Ubah ${c.name}`}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Hapus ${c.name}`}
                onClick={async () => {
                  if (!confirm(`Hapus kategori "${c.name}"?`)) return;
                  try {
                    if (tab === "produk") await deleteCategory(c.id);
                    else await deleteExpenseCategory(c.id);
                    toast("Kategori dihapus", "success");
                    reload();
                  } catch {
                    toast("Kategori tidak bisa dihapus karena masih dipakai.", "error");
                  }
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <CategoryModal
          category={editing}
          tab={tab}
          storeId={store?.id ?? ""}
          sim={sim}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function CategoryModal({
  category,
  tab,
  storeId,
  sim,
  onClose,
  onSaved,
}: {
  category: Partial<AnyCategory>;
  tab: Tab;
  storeId: string;
  sim: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = React.useState(category.name ?? "");
  const [color, setColor] = React.useState(category.color ?? PALETTE[0]);
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload = { id: category.id, name, color, sort_order: category.sort_order ?? 0 };
      if (tab === "produk") await saveCategory(payload, storeId, sim);
      else await saveExpenseCategory(payload, storeId, sim);

      toast(category.id ? "Kategori diperbarui" : "Kategori ditambahkan", "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan kategori", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category.id ? "Ubah kategori" : "Kategori baru"}
      description={tab === "produk" ? "Kategori produk" : "Kategori pengeluaran"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={(e) => void submit(e)} loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama kategori" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tab === "produk" ? "Minuman" : "Bahan Baku"}
            required
            autoFocus
          />
        </Field>

        <Field label="Warna" hint="Dipakai di grid kasir dan grafik laporan">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Warna ${c}`}
                className={cx(
                  "size-9 rounded-xl transition-transform",
                  color === c && "ring-2 ring-slate-900 ring-offset-2",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
