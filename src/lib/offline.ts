"use client";

import Dexie, { type Table } from "dexie";
import * as React from "react";
import type { PaymentMethod, Product } from "@/lib/types";
import type { CartLine } from "@/lib/services/sales";
import { createSale } from "@/lib/services/sales";

export interface CachedProduct extends Product {
  cached_at: number;
}

export interface PendingSale {
  client_ref: string;
  shift_id: string;
  lines: CartLine[];
  discount: number;
  payment_method: PaymentMethod;
  paid_amount: number;
  note: string | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

class WarkasDB extends Dexie {
  products!: Table<CachedProduct, string>;
  pendingSales!: Table<PendingSale, string>;

  constructor() {
    super("warkas");
    this.version(1).stores({
      products: "id, store_id, is_simulation, name",
      pendingSales: "client_ref, shift_id, created_at",
    });
  }
}

/** Dexie hanya boleh diinstansiasi di browser. */
let dbInstance: WarkasDB | null = null;
export function db(): WarkasDB {
  if (typeof window === "undefined") {
    throw new Error("Penyimpanan offline hanya tersedia di browser");
  }
  if (!dbInstance) dbInstance = new WarkasDB();
  return dbInstance;
}

export async function cacheProducts(products: Product[], sim: boolean) {
  const now = Date.now();
  const rows: CachedProduct[] = products.map((p) => ({ ...p, cached_at: now }));
  await db().transaction("rw", db().products, async () => {
    const stale = await db().products.where("is_simulation").equals(sim ? 1 : 0).toArray();
    // IndexedDB tidak bisa mengindeks boolean; saring manual agar aman.
    const staleIds = stale.filter((p) => p.is_simulation === sim).map((p) => p.id);
    if (staleIds.length) await db().products.bulkDelete(staleIds);
    await db().products.bulkPut(rows);
  });
}

export async function readCachedProducts(sim: boolean): Promise<Product[]> {
  const all = await db().products.toArray();
  return all.filter((p) => p.is_simulation === sim && p.is_active);
}

/** Kurangi stok di cache lokal supaya tampilan tetap masuk akal saat offline. */
export async function decrementCachedStock(lines: CartLine[]) {
  await db().transaction("rw", db().products, async () => {
    for (const line of lines) {
      const p = await db().products.get(line.product_id);
      if (p && p.track_stock) {
        await db().products.update(line.product_id, { stock: Math.max(p.stock - line.qty, 0) });
      }
    }
  });
}

export async function queueSale(sale: Omit<PendingSale, "attempts" | "last_error">) {
  await db().pendingSales.put({ ...sale, attempts: 0, last_error: null });
  await decrementCachedStock(sale.lines);
}

export async function countPending() {
  return db().pendingSales.count();
}

export async function listPending() {
  return db().pendingSales.orderBy("created_at").toArray();
}

export interface SyncResult {
  synced: number;
  failed: number;
}

/**
 * Kirim ulang transaksi offline. `client_ref` membuat RPC `create_sale`
 * idempoten, jadi pengiriman ganda tidak menghasilkan transaksi dobel.
 */
export async function syncPendingSales(): Promise<SyncResult> {
  const pending = await listPending();
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      await createSale({
        shiftId: sale.shift_id,
        lines: sale.lines,
        discount: sale.discount,
        paymentMethod: sale.payment_method,
        paidAmount: sale.paid_amount,
        note: sale.note ?? undefined,
        clientRef: sale.client_ref,
        createdAt: sale.created_at,
      });
      await db().pendingSales.delete(sale.client_ref);
      synced += 1;
    } catch (err) {
      failed += 1;
      await db().pendingSales.update(sale.client_ref, {
        attempts: sale.attempts + 1,
        last_error: err instanceof Error ? err.message : "Gagal sinkron",
      });
    }
  }

  return { synced, failed };
}

export async function clearPending() {
  await db().pendingSales.clear();
}

/* ---------------- Hooks ---------------- */

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Status koneksi dibaca langsung dari browser lewat useSyncExternalStore,
 * jadi tidak ada render tambahan hanya untuk menyalin nilai awal.
 * Saat render di server dianggap online supaya markup awal konsisten.
 */
export function useOnlineStatus() {
  return React.useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function newClientRef() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
