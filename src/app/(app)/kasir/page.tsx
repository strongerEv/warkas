"use client";

import * as React from "react";
import Link from "next/link";
import {
  CloudOff,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { listCategories, listProducts } from "@/lib/services/catalog";
import {
  cartQty,
  cartSubtotal,
  createSale,
  getOpenShift,
  type CartLine,
} from "@/lib/services/sales";
import {
  cacheProducts,
  countPending,
  newClientRef,
  queueSale,
  readCachedProducts,
  syncPendingSales,
  useOnlineStatus,
} from "@/lib/offline";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  useToast,
  cx,
} from "@/components/ui";
import { ReceiptModal } from "@/components/receipt";
import {
  PAYMENT_METHOD_LABEL,
  type Category,
  type PaymentMethod,
  type Product,
  type Shift,
  type Transaction,
} from "@/lib/types";
import { rupiah } from "@/lib/format";

const QUICK_CASH = [5000, 10000, 20000, 50000, 100000];
const METHODS: PaymentMethod[] = ["cash", "qris", "transfer", "other"];

export default function KasirPage() {
  const { profile, store, sim, loading: appLoading } = useApp();
  const toast = useToast();
  const online = useOnlineStatus();

  const [shift, setShift] = React.useState<Shift | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [activeCat, setActiveCat] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [pending, setPending] = React.useState(0);
  const [receipt, setReceipt] = React.useState<Transaction | null>(null);
  const [discountFor, setDiscountFor] = React.useState<CartLine | null>(null);

  const prefix = store?.currency_prefix ?? "Rp";
  const userId = profile?.id;

  /* ---------- Muat data ---------- */
  // `tick` dinaikkan dari event handler untuk memaksa muat ulang, sehingga
  // seluruh pembaruan state terjadi di dalam efek setelah await.
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (appLoading || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const sh = await getOpenShift(userId);
        if (cancelled) return;
        setShift(sh);

        try {
          const [prods, cats] = await Promise.all([
            listProducts(sim, { activeOnly: true }),
            listCategories(sim),
          ]);
          if (cancelled) return;
          setProducts(prods);
          setCategories(cats);
          await cacheProducts(prods, sim);
        } catch {
          // Jaringan bermasalah — pakai katalog yang tersimpan di perangkat.
          const cached = await readCachedProducts(sim);
          if (cancelled) return;
          setProducts(cached);
          if (cached.length) toast("Menggunakan katalog offline", "info");
        }

        const count = await countPending();
        if (!cancelled) setPending(count);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat kasir", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appLoading, userId, sim, tick, toast]);

  /* ---------- Sinkron otomatis saat koneksi kembali ---------- */
  React.useEffect(() => {
    if (!online) return;
    let cancelled = false;

    (async () => {
      if ((await countPending()) === 0) return;
      const result = await syncPendingSales();
      if (cancelled) return;
      setPending(await countPending());
      if (result.synced > 0) {
        toast(`${result.synced} transaksi offline berhasil disinkronkan`, "success");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [online, toast]);

  /* ---------- Keranjang ---------- */
  const addToCart = React.useCallback(
    (product: Product) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.product_id === product.id);
        if (idx >= 0) {
          const line = prev[idx];
          if (product.track_stock && line.qty + 1 > product.stock) {
            toast(`Stok "${product.name}" tinggal ${product.stock}`, "error");
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...line, qty: line.qty + 1 };
          return next;
        }
        if (product.track_stock && product.stock < 1) {
          toast(`Stok "${product.name}" habis`, "error");
          return prev;
        }
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            price: Number(product.price),
            qty: 1,
            discount: 0,
            stock: product.stock,
            track_stock: product.track_stock,
          },
        ];
      });
    },
    [toast],
  );

  function setQty(productId: string, qty: number) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.product_id !== productId) return [l];
        if (qty <= 0) return [];
        if (l.track_stock && qty > l.stock) {
          toast(`Stok "${l.name}" tinggal ${l.stock}`, "error");
          return [{ ...l, qty: l.stock }];
        }
        return [{ ...l, qty }];
      }),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.product_id !== productId));
  }

  const subtotal = cartSubtotal(lines);
  const totalQty = cartQty(lines);

  /* ---------- Filter produk ---------- */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat && p.category_id !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, activeCat]);

  if (appLoading || loading) return <LoadingBlock />;

  if (!shift) {
    return (
      <Card>
        <EmptyState
          icon={ShoppingCart}
          title="Belum ada shift terbuka"
          description="Buka shift dulu dan catat modal awal kas, supaya semua transaksi tercatat rapi dan selisih kas bisa dihitung saat tutup shift."
          action={
            <Link href="/shift">
              <Button size="lg">Buka shift sekarang</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-var(--shell-offset,0px))] flex-col lg:mx-0 lg:my-0 lg:h-[calc(100dvh-3rem)] lg:flex-row lg:gap-4">
      {/* ---------- Katalog ---------- */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-3 border-b border-slate-200 bg-white px-4 py-3 lg:rounded-t-2xl lg:border lg:border-b-slate-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk atau SKU…"
                className="pl-9"
                aria-label="Cari produk"
              />
            </div>
            {!online && (
              <Badge tone="amber" className="shrink-0 self-center px-3 py-2">
                <CloudOff className="size-3.5" /> Offline
              </Badge>
            )}
            {pending > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 self-center"
                onClick={async () => {
                  const r = await syncPendingSales();
                  setPending(await countPending());
                  toast(
                    r.failed
                      ? `${r.synced} tersinkron, ${r.failed} gagal`
                      : `${r.synced} transaksi tersinkron`,
                    r.failed ? "error" : "success",
                  );
                  reload();
                }}
              >
                <RefreshCw className="size-4" /> {pending} menunggu
              </Button>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <CategoryChip active={!activeCat} onClick={() => setActiveCat(null)}>
                Semua
              </CategoryChip>
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  active={activeCat === c.id}
                  color={c.color}
                  onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
                >
                  {c.name}
                </CategoryChip>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 pb-28 lg:rounded-b-2xl lg:border lg:border-t-0 lg:border-slate-200 lg:pb-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={products.length ? "Produk tidak ditemukan" : "Belum ada produk"}
              description={
                products.length
                  ? "Coba kata kunci atau kategori lain."
                  : sim
                    ? "Mode simulasi aktif. Buat data simulasi dulu di menu Pengaturan."
                    : "Tambahkan produk dulu di menu Produk."
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((p) => (
                <ProductTile
                  key={p.id}
                  product={p}
                  prefix={prefix}
                  qtyInCart={lines.find((l) => l.product_id === p.id)?.qty ?? 0}
                  onAdd={() => addToCart(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Keranjang (desktop) ---------- */}
      <aside className="hidden w-[360px] shrink-0 lg:block">
        <Card className="flex h-full flex-col overflow-hidden">
          <CartPanel
            lines={lines}
            prefix={prefix}
            subtotal={subtotal}
            onQty={setQty}
            onRemove={removeLine}
            onDiscount={setDiscountFor}
            onClear={() => setLines([])}
            onPay={() => setPayOpen(true)}
          />
        </Card>
      </aside>

      {/* ---------- Bar keranjang (mobile) ---------- */}
      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] lg:hidden">
          <Button size="lg" className="w-full justify-between" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingCart className="size-4" />
              {totalQty} item
            </span>
            <span>{rupiah(subtotal, prefix)}</span>
          </Button>
        </div>
      )}

      <Modal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Keranjang"
        size="md"
      >
        <CartPanel
          lines={lines}
          prefix={prefix}
          subtotal={subtotal}
          embedded
          onQty={setQty}
          onRemove={removeLine}
          onDiscount={setDiscountFor}
          onClear={() => setLines([])}
          onPay={() => {
            setCartOpen(false);
            setPayOpen(true);
          }}
        />
      </Modal>

      {discountFor && (
        <ItemDiscountModal
          key={discountFor.product_id}
          line={discountFor}
          prefix={prefix}
          onClose={() => setDiscountFor(null)}
          onSave={(productId, discount) => {
            setLines((prev) =>
              prev.map((l) => (l.product_id === productId ? { ...l, discount } : l)),
            );
            setDiscountFor(null);
          }}
        />
      )}

      {payOpen && (
        <PaymentModal
        onClose={() => setPayOpen(false)}
        lines={lines}
        subtotal={subtotal}
        prefix={prefix}
        shift={shift}
        online={online}
        onDone={async (trx, offline) => {
          setPayOpen(false);
          setLines([]);
          if (offline) {
            setPending(await countPending());
            toast("Transaksi disimpan offline, akan disinkronkan otomatis", "info");
          }
          setReceipt(trx);
          if (!offline) reload();
        }}
        />
      )}

      <ReceiptModal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        transaction={receipt}
        store={store}
        cashierName={profile?.name}
      />
    </div>
  );
}

/* ================= Sub-komponen ================= */

function CategoryChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {color && (
        <span
          className="size-2 rounded-full"
          style={{ background: active ? "#fff" : color }}
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

function ProductTile({
  product,
  prefix,
  qtyInCart,
  onAdd,
}: {
  product: Product;
  prefix: string;
  qtyInCart: number;
  onAdd: () => void;
}) {
  const habis = product.track_stock && product.stock <= 0;
  const menipis = product.track_stock && product.stock > 0 && product.stock <= product.low_stock_threshold;
  const color = product.category?.color ?? "#94a3b8";

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={habis}
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition-all",
        habis
          ? "border-slate-200 opacity-50"
          : "border-slate-200 hover:border-brand-400 hover:shadow-md active:scale-[0.98]",
      )}
    >
      <div
        className="relative flex h-20 items-center justify-center overflow-hidden"
        style={{ background: product.image_url ? undefined : `${color}1a` }}
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="size-7" style={{ color }} aria-hidden />
        )}
        {qtyInCart > 0 && (
          <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white shadow">
            {qtyInCart}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">
          {product.name}
        </p>
        <p className="mt-auto text-sm font-bold text-brand-700">
          {rupiah(product.price, prefix)}
        </p>
        {product.track_stock && (
          <p
            className={cx(
              "text-xs",
              habis ? "font-medium text-red-600" : menipis ? "font-medium text-amber-600" : "text-slate-400",
            )}
          >
            {habis ? "Stok habis" : `Stok ${product.stock}`}
          </p>
        )}
      </div>
    </button>
  );
}

function CartPanel({
  lines,
  prefix,
  subtotal,
  embedded,
  onQty,
  onRemove,
  onDiscount,
  onClear,
  onPay,
}: {
  lines: CartLine[];
  prefix: string;
  subtotal: number;
  embedded?: boolean;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onDiscount: (line: CartLine) => void;
  onClear: () => void;
  onPay: () => void;
}) {
  return (
    <>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Keranjang</h2>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-slate-500 hover:text-red-600"
            >
              Kosongkan
            </button>
          )}
        </div>
      )}

      <div className={cx("flex-1 overflow-y-auto", embedded ? "" : "px-2 py-2")}>
        {lines.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Keranjang kosong"
            description="Tap produk di sebelah kiri untuk menambahkannya."
          />
        ) : (
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={line.product_id} className="rounded-xl px-2 py-2 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{line.name}</p>
                    <p className="text-xs text-slate-500">
                      {rupiah(line.price, prefix)} × {line.qty}
                      {line.discount > 0 && (
                        <span className="ml-1 text-emerald-600">
                          − {rupiah(line.discount, prefix)}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                    {rupiah(line.price * line.qty - line.discount, prefix)}
                  </p>
                </div>

                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onQty(line.product_id, line.qty - 1)}
                    aria-label={`Kurangi ${line.name}`}
                    className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(e) => onQty(line.product_id, Number(e.target.value))}
                    aria-label={`Jumlah ${line.name}`}
                    className="h-8 w-12 rounded-lg border border-slate-200 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onQty(line.product_id, line.qty + 1)}
                    aria-label={`Tambah ${line.name}`}
                    className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                  >
                    <Plus className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDiscount(line)}
                    className="ml-auto grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                    aria-label={`Diskon ${line.name}`}
                  >
                    <Tag className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(line.product_id)}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Hapus ${line.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cx("border-t border-slate-200 p-4", embedded && "-mx-5 -mb-4 mt-4")}>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-slate-500">Subtotal</span>
          <span className="text-xl font-bold tabular-nums text-slate-900">
            {rupiah(subtotal, prefix)}
          </span>
        </div>
        <Button size="lg" className="w-full" disabled={lines.length === 0} onClick={onPay}>
          Bayar
        </Button>
      </div>
    </>
  );
}

function ItemDiscountModal({
  line,
  prefix,
  onClose,
  onSave,
}: {
  line: CartLine;
  prefix: string;
  onClose: () => void;
  onSave: (productId: string, discount: number) => void;
}) {
  const [value, setValue] = React.useState(() => String(line.discount || ""));
  const max = line.price * line.qty;
  const parsed = Math.min(Math.max(Number(value) || 0, 0), max);

  return (
    <Modal
      open
      onClose={onClose}
      title="Diskon item"
      description={line.name}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => onSave(line.product_id, parsed)}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Harga item: <strong>{rupiah(max, prefix)}</strong>
        </p>
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="text-lg font-semibold"
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          {[10, 20, 50].map((pct) => (
            <Button
              key={pct}
              size="sm"
              variant="outline"
              onClick={() => setValue(String(Math.round((max * pct) / 100)))}
            >
              {pct}%
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setValue("0")}>
            Hapus diskon
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PaymentModal({
  onClose,
  lines,
  subtotal,
  prefix,
  shift,
  online,
  onDone,
}: {
  onClose: () => void;
  lines: CartLine[];
  subtotal: number;
  prefix: string;
  shift: Shift;
  online: boolean;
  onDone: (trx: Transaction, offline: boolean) => void;
}) {
  const toast = useToast();
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [discount, setDiscount] = React.useState("");
  const [paid, setPaid] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const trxDiscount = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = subtotal - trxDiscount;
  const paidAmount = method === "cash" ? Number(paid) || 0 : total;
  const change = paidAmount - total;
  const kurang = method === "cash" && paidAmount < total;

  async function submit() {
    setSaving(true);
    const clientRef = newClientRef();
    const createdAt = new Date().toISOString();

    try {
      if (!online) throw new Error("offline");

      const trx = await createSale({
        shiftId: shift.id,
        lines,
        discount: trxDiscount,
        paymentMethod: method,
        paidAmount,
        note: note || undefined,
        clientRef,
      });

      // RPC hanya mengembalikan baris transaksi; item disusun ulang untuk struk.
      onDone({ ...trx, items: toReceiptItems(lines) }, false);
    } catch (err) {
      const isOffline = !online || err instanceof TypeError || (err as Error).message === "offline";

      if (!isOffline) {
        toast(err instanceof Error ? err.message : "Gagal menyimpan transaksi", "error");
        setSaving(false);
        return;
      }

      await queueSale({
        client_ref: clientRef,
        shift_id: shift.id,
        lines,
        discount: trxDiscount,
        payment_method: method,
        paid_amount: paidAmount,
        note: note || null,
        created_at: createdAt,
      });

      onDone(
        {
          id: clientRef,
          store_id: shift.store_id,
          shift_id: shift.id,
          user_id: shift.user_id,
          code: `OFFLINE-${clientRef.slice(0, 6).toUpperCase()}`,
          client_ref: clientRef,
          subtotal,
          discount: trxDiscount,
          total,
          payment_method: method,
          paid_amount: paidAmount,
          change_amount: Math.max(change, 0),
          note: note || null,
          created_at: createdAt,
          is_simulation: shift.is_simulation,
          items: toReceiptItems(lines),
        },
        true,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Pembayaran"
      description={`${lines.length} jenis produk`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => void submit()} loading={saving} disabled={kurang}>
            Selesaikan • {rupiah(total, prefix)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="flex items-baseline justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums">{rupiah(subtotal, prefix)}</span>
          </div>
          {trxDiscount > 0 && (
            <div className="mt-1 flex items-baseline justify-between text-sm text-emerald-700">
              <span>Diskon transaksi</span>
              <span className="tabular-nums">−{rupiah(trxDiscount, prefix)}</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
            <span className="font-medium text-slate-900">Total</span>
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {rupiah(total, prefix)}
            </span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Metode pembayaran</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cx(
                  "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  method === m
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {PAYMENT_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Diskon transaksi</span>
            <Input
              type="number"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Catatan</span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opsional"
            />
          </label>
        </div>

        {method === "cash" && (
          <div className="space-y-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Uang diterima</span>
              <Input
                type="number"
                inputMode="numeric"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                placeholder={String(total)}
                className="text-lg font-semibold"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPaid(String(total))}>
                Uang pas
              </Button>
              {QUICK_CASH.filter((v) => v >= total).slice(0, 4).map((v) => (
                <Button key={v} size="sm" variant="outline" onClick={() => setPaid(String(v))}>
                  {rupiah(v, prefix)}
                </Button>
              ))}
            </div>

            <div
              className={cx(
                "flex items-baseline justify-between rounded-xl px-4 py-3",
                kurang ? "bg-red-50" : "bg-emerald-50",
              )}
            >
              <span className={cx("text-sm font-medium", kurang ? "text-red-700" : "text-emerald-700")}>
                {kurang ? "Uang kurang" : "Kembalian"}
              </span>
              <span
                className={cx(
                  "text-xl font-bold tabular-nums",
                  kurang ? "text-red-700" : "text-emerald-700",
                )}
              >
                {rupiah(Math.abs(change), prefix)}
              </span>
            </div>
          </div>
        )}

        {!online && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <CloudOff className="mt-0.5 size-4 shrink-0" />
            Sedang offline. Transaksi disimpan di perangkat dan otomatis dikirim saat koneksi
            kembali.
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Bentuk item untuk struk lokal (transaksi online mengembalikan header saja).
 * Modal sengaja dikosongkan: struk adalah dokumen untuk pembeli, dan angka
 * HPP yang sebenarnya tetap tersimpan di database lewat `create_sale`.
 */
function toReceiptItems(lines: CartLine[]) {
  return lines.map((l, i) => ({
    id: `${l.product_id}-${i}`,
    transaction_id: "",
    product_id: l.product_id,
    product_name: l.name,
    qty: l.qty,
    price_at_sale: l.price,
    cost_at_sale: 0,
    discount: l.discount,
    subtotal: l.price * l.qty - l.discount,
  }));
}
