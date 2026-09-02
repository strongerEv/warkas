import { supabase } from "@/lib/supabase/client";
import type { PaymentMethod, Shift, ShiftReport, Transaction } from "@/lib/types";

export interface CartLine {
  product_id: string;
  name: string;
  price: number;
  qty: number;
  discount: number;
  stock: number;
  track_stock: boolean;
}

/* ---------------- Shift ---------------- */

export async function getOpenShift(userId: string): Promise<Shift | null> {
  const { data, error } = await supabase()
    .from("shifts")
    .select("*, user:profiles(id, name)")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Shift | null;
}

export async function openShift(openingCash: number): Promise<Shift> {
  const { data, error } = await supabase().rpc("open_shift", { p_opening_cash: openingCash });
  if (error) throw error;
  return data as unknown as Shift;
}

export async function closeShift(shiftId: string, closingCash: number, note?: string): Promise<Shift> {
  const { data, error } = await supabase().rpc("close_shift", {
    p_shift_id: shiftId,
    p_closing_cash: closingCash,
    p_note: note ?? undefined,
  });
  if (error) throw error;
  return data as unknown as Shift;
}

export async function expectedCash(shiftId: string): Promise<number> {
  const { data, error } = await supabase().rpc("shift_expected_cash", { p_shift_id: shiftId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function listShifts(sim: boolean, limit = 50): Promise<Shift[]> {
  const { data, error } = await supabase()
    .from("shifts")
    .select("*, user:profiles(id, name)")
    .eq("is_simulation", sim)
    .order("opened_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Shift[];
}

export async function getShiftReport(shiftId: string): Promise<ShiftReport> {
  const { data, error } = await supabase().rpc("shift_report", { p_shift_id: shiftId });
  if (error) throw error;
  return data as unknown as ShiftReport;
}

/* ---------------- Penjualan ---------------- */

export interface SalePayload {
  shiftId: string;
  lines: CartLine[];
  discount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  note?: string;
  clientRef?: string;
  createdAt?: string;
}

export async function createSale(payload: SalePayload): Promise<Transaction> {
  const { data, error } = await supabase().rpc("create_sale", {
    p_shift_id: payload.shiftId,
    p_items: payload.lines.map((l) => ({
      product_id: l.product_id,
      qty: l.qty,
      discount: l.discount,
    })),
    p_discount: payload.discount,
    p_payment_method: payload.paymentMethod,
    p_paid_amount: payload.paidAmount,
    p_note: payload.note ?? undefined,
    p_client_ref: payload.clientRef ?? undefined,
    p_created_at: payload.createdAt ?? undefined,
  });
  if (error) throw error;
  return data as unknown as Transaction;
}

export async function listTransactions(
  sim: boolean,
  opts?: { shiftId?: string; from?: Date; to?: Date; limit?: number },
): Promise<Transaction[]> {
  let query = supabase()
    .from("transactions")
    .select("*, user:profiles(id, name), items:transaction_items(*)")
    .eq("is_simulation", sim)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.shiftId) query = query.eq("shift_id", opts.shiftId);
  if (opts?.from) query = query.gte("created_at", opts.from.toISOString());
  if (opts?.to) query = query.lt("created_at", opts.to.toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Transaction[];
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase()
    .from("transactions")
    .select("*, user:profiles(id, name), items:transaction_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Transaction | null;
}

export async function voidTransaction(id: string, reason?: string) {
  const { error } = await supabase().rpc("void_transaction", {
    p_transaction_id: id,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

/* ---------------- Util keranjang ---------------- */

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((sum, l) => sum + l.price * l.qty - l.discount, 0);
}

export function cartQty(lines: CartLine[]) {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}
