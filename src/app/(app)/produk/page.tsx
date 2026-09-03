"use client";

import * as React from "react";
import {
  AlertTriangle,
  History,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  adjustStock,
  deleteProduct,
  listCategories,
  listProducts,
  listStockLogs,
  saveProduct,
  uploadImage,
} from "@/lib/services/catalog";
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
  useToast,
  cx,
} from "@/components/ui";
import { AdminOnly, PageHeader } from "@/components/app-shell";
import { STOCK_REASON_LABEL, type Category, type Product, type StockLog } from "@/lib/types";
import { rupiah, tanggalJam } from "@/lib/format";

export default function ProdukPage() {
  return (
    <AdminOnly>
      <ProdukInner />
    </AdminOnly>
  );
}

function ProdukInner() {
  const { store, sim } = useApp();
  const toast = useToast();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<Partial<Product> | null>(null);
  const [stockFor, setStockFor] = React.useState<Product | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [logs, setLogs] = React.useState<StockLog[]>([]);

  const prefix = store?.currency_prefix ?? "Rp";

  // `tick` dinaikkan dari event handler untuk memaksa muat ulang, sehingga
  // seluruh pembaruan state terjadi di dalam efek setelah await.
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [p, c] = await Promise.all([listProducts(sim), listCategories(sim)]);
        if (cancelled) return;
        setProducts(p);
        setCategories(c);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat produk", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sim, tick, toast]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  if (loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Produk"
        description={
          sim
            ? "Katalog mode simulasi — terpisah dari produk asli."
            : "Kelola daftar produk, harga, dan stok."
        }
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                setLogs(await listStockLogs(sim));
                setHistoryOpen(true);
              }}
            >
              <History className="size-4" /> Riwayat stok
            </Button>
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> Produk baru
            </Button>
          </div>
        }
      />

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk atau SKU…"
            className="pl-9"
            aria-label="Cari produk"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title={products.length ? "Produk tidak ditemukan" : "Belum ada produk"}
            description={
              products.length
                ? "Coba kata kunci lain."
                : "Tambahkan produk pertama supaya kasir bisa mulai berjualan."
            }
            action={
              !products.length && <Button onClick={() => setEditing({})}>Tambah produk</Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Produk</th>
                  <th className="px-4 py-2.5 font-medium">Kategori</th>
                  <th className="px-4 py-2.5 text-right font-medium">Modal</th>
                  <th className="px-4 py-2.5 text-right font-medium">Harga jual</th>
                  <th className="px-4 py-2.5 text-right font-medium">Margin</th>
                  <th className="px-4 py-2.5 text-right font-medium">Stok</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const menipis = p.track_stock && p.stock <= p.low_stock_threshold;
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg"
                            style={{ background: `${p.category?.color ?? "#94a3b8"}1a` }}
                          >
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" className="size-full object-cover" />
                            ) : (
                              <Package
                                className="size-4"
                                style={{ color: p.category?.color ?? "#94a3b8" }}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{p.name}</p>
                            {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {p.cost_price > 0 ? (
                          rupiah(p.cost_price, prefix)
                        ) : (
                          <span className="text-xs text-amber-600">belum diisi</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                        {rupiah(p.price, prefix)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.cost_price > 0 && p.price > 0 ? (
                          <span
                            className={cx(
                              "font-medium",
                              p.price > p.cost_price ? "text-emerald-600" : "text-red-600",
                            )}
                          >
                            {(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.track_stock ? (
                          <button
                            type="button"
                            onClick={() => setStockFor(p)}
                            className={cx(
                              "rounded-lg px-2 py-1 font-medium tabular-nums hover:bg-slate-100",
                              menipis ? "text-amber-600" : "text-slate-700",
                            )}
                          >
                            {menipis && <AlertTriangle className="mr-1 inline size-3.5" />}
                            {p.stock}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">tidak dilacak</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={p.is_active ? "green" : "slate"}>
                          {p.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(p)}
                            aria-label={`Ubah ${p.name}`}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus ${p.name}`}
                            onClick={async () => {
                              if (!confirm(`Hapus produk "${p.name}"?`)) return;
                              try {
                                await deleteProduct(p.id);
                                toast("Produk dihapus", "success");
                                reload();
                              } catch {
                                toast(
                                  "Produk tidak bisa dihapus karena sudah dipakai di transaksi. Nonaktifkan saja.",
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <ProductModal
          key={editing.id ?? "baru"}
          product={editing}
          categories={categories}
          storeId={store?.id ?? ""}
          sim={sim}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {stockFor && (
        <StockModal
          key={stockFor.id}
          product={stockFor}
          prefix={prefix}
          onClose={() => setStockFor(null)}
          onSaved={() => {
            setStockFor(null);
            reload();
          }}
        />
      )}

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Riwayat perubahan stok"
        size="lg"
      >
        {logs.length === 0 ? (
          <EmptyState icon={History} title="Belum ada perubahan stok" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {l.product?.name ?? "Produk dihapus"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {STOCK_REASON_LABEL[l.reason]} • {tanggalJam(l.created_at)}
                    {l.user?.name && ` • ${l.user.name}`}
                    {l.note && ` • ${l.note}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cx(
                      "text-sm font-semibold tabular-nums",
                      l.change_qty > 0 ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {l.change_qty > 0 ? "+" : ""}
                    {l.change_qty}
                  </p>
                  <p className="text-xs text-slate-400">sisa {l.stock_after}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function ProductModal({
  product,
  categories,
  storeId,
  sim,
  onClose,
  onSaved,
}: {
  product: Partial<Product>;
  categories: Category[];
  storeId: string;
  sim: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = React.useState<Partial<Product>>(() => ({
    track_stock: true,
    is_active: true,
    low_stock_threshold: 5,
    stock: 0,
    ...product,
  }));
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const isNew = !product.id;

  function set<K extends keyof Product>(key: K, value: Product[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) return;

    setSaving(true);
    try {
      await saveProduct({ ...form, name: form.name }, storeId, sim);
      toast(isNew ? "Produk ditambahkan" : "Produk diperbarui", "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan produk", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Produk baru" : "Ubah produk"}
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
        <Field label="Nama produk" required>
          <Input
            value={form.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nasi Goreng Spesial"
            required
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Harga modal (HPP)" hint="Modal per unit. Dipakai menghitung laba.">
            <Input
              type="number"
              inputMode="numeric"
              value={form.cost_price ?? ""}
              onChange={(e) => set("cost_price", Number(e.target.value))}
              placeholder="0"
            />
          </Field>

          <Field label="Harga jual" required>
            <Input
              type="number"
              inputMode="numeric"
              value={form.price ?? ""}
              onChange={(e) => set("price", Number(e.target.value))}
              placeholder="0"
              required
            />
          </Field>
        </div>

        <MarginPreview cost={Number(form.cost_price ?? 0)} price={Number(form.price ?? 0)} />

        <Field label="Kategori">
          <Select
            value={form.category_id ?? ""}
            onChange={(e) => set("category_id", e.target.value || null)}
          >
            <option value="">Tanpa kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU / Barcode" hint="Opsional">
            <Input
              value={form.sku ?? ""}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="ABC-001"
            />
          </Field>

          <Field label="Batas stok menipis" hint="Alert muncul saat stok ≤ angka ini">
            <Input
              type="number"
              inputMode="numeric"
              value={form.low_stock_threshold ?? 5}
              onChange={(e) => set("low_stock_threshold", Number(e.target.value))}
            />
          </Field>
        </div>

        {isNew && (
          <Field label="Stok awal" hint="Tercatat otomatis di riwayat stok">
            <Input
              type="number"
              inputMode="numeric"
              value={form.stock ?? 0}
              onChange={(e) => set("stock", Number(e.target.value))}
            />
          </Field>
        )}

        <Field label="Gambar produk" hint="Opsional, memudahkan kasir mengenali produk">
          <div className="flex items-center gap-3">
            {form.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.image_url}
                alt=""
                className="size-14 rounded-xl object-cover"
              />
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              <ImagePlus className="size-4" />
              {uploading ? "Mengunggah…" : form.image_url ? "Ganti gambar" : "Unggah gambar"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    set("image_url", await uploadImage("product-images", file, storeId));
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Gagal unggah gambar", "error");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {form.image_url && (
              <button
                type="button"
                onClick={() => set("image_url", null)}
                className="text-sm text-slate-500 hover:text-red-600"
              >
                Hapus
              </button>
            )}
          </div>
        </Field>

        <div className="space-y-2 rounded-xl bg-slate-50 p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.track_stock ?? true}
              onChange={(e) => set("track_stock", e.target.checked)}
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              Lacak stok
              <span className="block text-xs text-slate-500">
                Matikan untuk produk jasa atau olahan yang stoknya tidak dihitung.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) => set("is_active", e.target.checked)}
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">Tampilkan di halaman kasir</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}

/** Menunjukkan langsung untung per unit dan marginnya saat harga diketik. */
function MarginPreview({ cost, price }: { cost: number; price: number }) {
  if (!price) return null;

  const untung = price - cost;
  const margin = (untung / price) * 100;
  const rugi = untung < 0;

  return (
    <div
      className={cx(
        "flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-4 py-3 text-sm",
        rugi ? "bg-red-50" : cost === 0 ? "bg-slate-50" : "bg-emerald-50",
      )}
    >
      {cost === 0 ? (
        <span className="text-slate-600">
          Modal belum diisi — laba produk ini belum bisa dihitung di laporan.
        </span>
      ) : (
        <>
          <span className={rugi ? "font-medium text-red-700" : "font-medium text-emerald-700"}>
            {rugi ? "Harga jual di bawah modal" : "Untung per unit"}
          </span>
          <span
            className={cx(
              "tabular-nums font-bold",
              rugi ? "text-red-700" : "text-emerald-700",
            )}
          >
            {rupiah(untung)} · margin {margin.toFixed(1)}%
          </span>
        </>
      )}
    </div>
  );
}

function StockModal({
  product,
  prefix,
  onClose,
  onSaved,
}: {
  product: Product;
  prefix: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [qty, setQty] = React.useState("");
  const [note, setNote] = React.useState("");
  const [mode, setMode] = React.useState<"in" | "out">("in");
  const [saving, setSaving] = React.useState(false);

  const change = (mode === "in" ? 1 : -1) * (Number(qty) || 0);
  const after = product.stock + change;

  return (
    <Modal
      open
      onClose={onClose}
      title="Penyesuaian stok"
      description={`${product.name} • stok saat ini ${product.stock}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!Number(qty) || after < 0}
            onClick={async () => {
              setSaving(true);
              try {
                await adjustStock(
                  product.id,
                  change,
                  mode === "in" ? "purchase" : "adjustment",
                  note || undefined,
                );
                toast("Stok diperbarui", "success");
                onSaved();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Gagal menyesuaikan stok", "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Harga jual {rupiah(product.price, prefix)}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("in")}
            className={cx(
              "rounded-xl border px-3 py-2.5 text-sm font-medium",
              mode === "in"
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            Stok masuk
          </button>
          <button
            type="button"
            onClick={() => setMode("out")}
            className={cx(
              "rounded-xl border px-3 py-2.5 text-sm font-medium",
              mode === "out"
                ? "border-red-600 bg-red-50 text-red-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            Stok keluar
          </button>
        </div>

        <Field label="Jumlah" required>
          <Input
            type="number"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            className="text-lg font-semibold"
            autoFocus
          />
        </Field>

        <Field label="Catatan" hint="Misalnya: belanja dari supplier, barang rusak">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {Number(qty) > 0 && (
          <p
            className={cx(
              "rounded-xl px-4 py-2.5 text-sm font-medium",
              after < 0 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-700",
            )}
          >
            {after < 0
              ? "Stok tidak boleh menjadi negatif."
              : `Stok setelah penyesuaian: ${after}`}
          </p>
        )}
      </div>
    </Modal>
  );
}
