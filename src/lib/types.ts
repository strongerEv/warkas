/**
 * Tipe domain Warkas.
 *
 * Ditulis manual agar aplikasi bisa dikembangkan sebelum database ter-deploy.
 * Setelah migrasi dijalankan, tipe hasil `supabase gen types` bisa dipakai
 * untuk menggantikan blok `Database` di bawah.
 */

export type UserRole = "admin" | "kasir";
export type ShiftStatus = "open" | "closed";
export type PaymentMethod = "cash" | "qris" | "transfer" | "other";
export type PaymentSource = "cash" | "non_cash";
export type ExpenseStatus = "pending" | "approved" | "rejected";
export type StockReason = "initial" | "sale" | "purchase" | "adjustment" | "void";
export type ResetType = "simulation" | "transactional" | "factory";
export type Recurrence = "weekly" | "monthly";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  other: "Lainnya",
};

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  initial: "Stok awal",
  sale: "Penjualan",
  purchase: "Pembelian",
  adjustment: "Penyesuaian",
  void: "Pembatalan",
};

export interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  simulation_mode: boolean;
  cashier_expense_limit: number;
  currency_prefix: string;
  timezone: string;
  receipt_footer: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  store_id: string | null;
  name: string;
  role: UserRole;
  code: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_simulation: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  price: number;
  /** Harga pokok / modal per unit, dipakai menghitung laba kotor. */
  cost_price: number;
  stock: number;
  low_stock_threshold: number;
  track_stock: boolean;
  image_url: string | null;
  sku: string | null;
  is_active: boolean;
  is_simulation: boolean;
  created_at: string;
  updated_at: string;
  category?: Pick<Category, "id" | "name" | "color"> | null;
}

export interface Shift {
  id: string;
  store_id: string;
  user_id: string;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  difference: number | null;
  status: ShiftStatus;
  note: string | null;
  opened_at: string;
  closed_at: string | null;
  is_simulation: boolean;
  user?: Pick<Profile, "id" | "name"> | null;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  price_at_sale: number;
  /** Modal per unit saat transaksi terjadi, dibekukan agar laporan lama stabil. */
  cost_at_sale: number;
  discount: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  store_id: string;
  shift_id: string | null;
  user_id: string;
  code: string;
  client_ref: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  paid_amount: number;
  change_amount: number;
  note: string | null;
  created_at: string;
  is_simulation: boolean;
  items?: TransactionItem[];
  user?: Pick<Profile, "id" | "name"> | null;
}

export interface ExpenseCategory {
  id: string;
  store_id: string;
  name: string;
  color: string;
  is_simulation: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  store_id: string;
  shift_id: string | null;
  user_id: string;
  category_id: string | null;
  amount: number;
  note: string | null;
  receipt_url: string | null;
  expense_date: string;
  payment_source: PaymentSource;
  status: ExpenseStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  is_simulation: boolean;
  category?: Pick<ExpenseCategory, "id" | "name" | "color"> | null;
  user?: Pick<Profile, "id" | "name"> | null;
}

export interface RecurringExpense {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  frequency: Recurrence;
  day_of_period: number;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  category?: Pick<ExpenseCategory, "id" | "name" | "color"> | null;
}

export interface StockLog {
  id: string;
  store_id: string;
  product_id: string;
  change_qty: number;
  stock_after: number;
  reason: StockReason;
  reference_id: string | null;
  user_id: string | null;
  note: string | null;
  created_at: string;
  is_simulation: boolean;
  product?: Pick<Product, "id" | "name"> | null;
  user?: Pick<Profile, "id" | "name"> | null;
}

export interface ActivityLog {
  id: string;
  store_id: string | null;
  user_id: string | null;
  action_type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user?: Pick<Profile, "id" | "name"> | null;
}

/* ---------- Bentuk hasil RPC laporan ---------- */

export interface ProdukLaba {
  nama: string;
  qty: number;
  omzet: number;
  hpp?: number;
  laba: number;
}

export interface DashboardReport {
  omzet: number;
  /** Modal barang yang terjual (harga pokok penjualan). */
  hpp: number;
  /** Omzet − HPP. */
  laba_kotor: number;
  jumlah_transaksi: number;
  total_diskon: number;
  /** Pengeluaran operasional yang sudah disetujui. */
  pengeluaran: number;
  /** Laba kotor − pengeluaran operasional. */
  laba_bersih: number;
  margin_kotor: number;
  margin_bersih: number;
  /** Jumlah item terjual yang modalnya belum diisi — laba kotor jadi terlalu optimistis. */
  item_tanpa_hpp: number;
  rata_transaksi: number;
  tren: {
    tanggal: string;
    omzet: number;
    transaksi: number;
    hpp: number;
    pengeluaran: number;
  }[];
  produk_terlaris: ProdukLaba[];
  produk_terlaba: ProdukLaba[];
  per_jam: { jam: number; transaksi: number; omzet: number }[];
  metode_bayar: { metode: PaymentMethod; total: number; jumlah: number }[];
  kategori_pengeluaran: { kategori: string; warna: string; total: number }[];
}

interface PeriodTotals {
  omzet: number;
  hpp: number;
  laba_kotor: number;
  pengeluaran: number;
  laba_bersih: number;
  jumlah_transaksi: number;
}

export interface ComparePeriods {
  sekarang: PeriodTotals;
  sebelumnya: PeriodTotals;
}

export interface ShiftReport {
  shift: Shift;
  kasir: string;
  omzet: number;
  hpp: number;
  laba_kotor: number;
  jumlah_transaksi: number;
  penjualan_tunai: number;
  pengeluaran_tunai: number;
  pengeluaran_total: number;
  kas_seharusnya: number;
  metode_bayar: { metode: PaymentMethod; total: number; jumlah: number }[];
  produk: { nama: string; qty: number; omzet: number; laba: number }[];
}
