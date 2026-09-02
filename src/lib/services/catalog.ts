import { supabase } from "@/lib/supabase/client";
import type { Category, ExpenseCategory, Product, StockLog, StockReason } from "@/lib/types";

/**
 * Lapisan akses data katalog.
 *
 * Setiap fungsi baca WAJIB menerima `sim` dan memfilter `is_simulation`,
 * sehingga katalog sandbox dan katalog asli tidak pernah tercampur —
 * pemisahan ini ada di sini, bukan hanya di komponen UI.
 */

export async function listCategories(sim: boolean): Promise<Category[]> {
  const { data, error } = await supabase()
    .from("categories")
    .select("*")
    .eq("is_simulation", sim)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function saveCategory(input: Partial<Category> & { name: string }, storeId: string, sim: boolean) {
  const payload = {
    name: input.name.trim(),
    color: input.color ?? "#64748b",
    sort_order: input.sort_order ?? 0,
  };
  const query = input.id
    ? supabase().from("categories").update(payload).eq("id", input.id)
    : supabase()
        .from("categories")
        .insert({ ...payload, store_id: storeId, is_simulation: sim });

  const { error } = await query;
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase().from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function listProducts(sim: boolean, opts?: { activeOnly?: boolean }): Promise<Product[]> {
  let query = supabase()
    .from("products")
    .select("*, category:categories(id, name, color)")
    .eq("is_simulation", sim)
    .order("name");

  if (opts?.activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function saveProduct(
  input: Partial<Product> & { name: string },
  storeId: string,
  sim: boolean,
) {
  const payload = {
    name: input.name.trim(),
    category_id: input.category_id || null,
    price: Number(input.price ?? 0),
    low_stock_threshold: Number(input.low_stock_threshold ?? 5),
    track_stock: input.track_stock ?? true,
    sku: input.sku?.trim() || null,
    image_url: input.image_url || null,
    is_active: input.is_active ?? true,
  };

  if (input.id) {
    // Stok tidak diubah lewat form produk — gunakan penyesuaian stok agar terekam di riwayat.
    const { error } = await supabase().from("products").update(payload).eq("id", input.id);
    if (error) throw error;
    return;
  }

  const stock = Number(input.stock ?? 0);
  const { data, error } = await supabase()
    .from("products")
    .insert({ ...payload, store_id: storeId, is_simulation: sim, stock: 0 })
    .select()
    .single();
  if (error) throw error;

  if (stock > 0 && data) {
    await adjustStock(data.id, stock, "initial", "Stok awal");
  }
}

export async function deleteProduct(id: string) {
  const { error } = await supabase().from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function adjustStock(
  productId: string,
  changeQty: number,
  reason: StockReason = "adjustment",
  note?: string,
) {
  const { error } = await supabase().rpc("adjust_stock", {
    p_product_id: productId,
    p_change_qty: changeQty,
    p_reason: reason,
    p_note: note ?? undefined,
  });
  if (error) throw error;
}

export async function listStockLogs(sim: boolean, productId?: string, limit = 100): Promise<StockLog[]> {
  let query = supabase()
    .from("stock_logs")
    .select("*, product:products(id, name), user:profiles(id, name)")
    .eq("is_simulation", sim)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as StockLog[];
}

export async function listLowStock(sim: boolean): Promise<Product[]> {
  const { data, error } = await supabase().rpc("low_stock_products", { p_simulation: sim });
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

/* ---------------- Kategori pengeluaran ---------------- */

export async function listExpenseCategories(sim: boolean): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase()
    .from("expense_categories")
    .select("*")
    .eq("is_simulation", sim)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function saveExpenseCategory(
  input: Partial<ExpenseCategory> & { name: string },
  storeId: string,
  sim: boolean,
) {
  const payload = { name: input.name.trim(), color: input.color ?? "#64748b" };
  const query = input.id
    ? supabase().from("expense_categories").update(payload).eq("id", input.id)
    : supabase()
        .from("expense_categories")
        .insert({ ...payload, store_id: storeId, is_simulation: sim });
  const { error } = await query;
  if (error) throw error;
}

export async function deleteExpenseCategory(id: string) {
  const { error } = await supabase().from("expense_categories").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Upload gambar ---------------- */

export async function uploadImage(bucket: "product-images" | "receipts", file: File, prefix: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase().storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;

  if (bucket === "product-images") {
    return supabase().storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  // Bucket struk bersifat privat — simpan path, URL bertanda tangan dibuat saat dibutuhkan.
  return path;
}

export async function signedReceiptUrl(path: string) {
  const { data, error } = await supabase().storage.from("receipts").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
