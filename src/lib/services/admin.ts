import { supabase } from "@/lib/supabase/client";
import type { Profile, ResetType, Store } from "@/lib/types";

/* ---------------- Toko & mode simulasi ---------------- */

export async function bootstrapStore(name: string, address?: string): Promise<Store> {
  const { data, error } = await supabase().rpc("bootstrap_store", {
    p_store_name: name,
    p_address: address ?? undefined,
  });
  if (error) throw error;
  return data as unknown as Store;
}

export async function updateStore(id: string, patch: Partial<Store>) {
  const { error } = await supabase()
    .from("stores")
    .update({
      name: patch.name,
      address: patch.address,
      phone: patch.phone,
      logo_url: patch.logo_url,
      cashier_expense_limit: patch.cashier_expense_limit,
      receipt_footer: patch.receipt_footer,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setSimulationMode(enabled: boolean): Promise<Store> {
  const { data, error } = await supabase().rpc("set_simulation_mode", { p_enabled: enabled });
  if (error) throw error;
  return data as unknown as Store;
}

export async function generateSimulationData(days: number) {
  const { data, error } = await supabase().rpc("generate_simulation_data", { p_days: days });
  if (error) throw error;
  return data as { hari: number; shift: number; transaksi: number; pengeluaran: number };
}

/* ---------------- Pengguna ---------------- */

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase()
    .from("profiles")
    .select("*")
    .order("role")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function setProfileActive(id: string, isActive: boolean) {
  const { error } = await supabase().from("profiles").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function updateProfile(id: string, patch: { name?: string; role?: Profile["role"] }) {
  const { error } = await supabase().from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setMyPin(code: string, pin: string) {
  const { error } = await supabase().rpc("set_my_pin", { p_code: code, p_pin: pin });
  if (error) throw error;
}

/* ---------------- Edge Functions ---------------- */

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke<T>(fn, { body });
  if (error) {
    // Edge Function mengembalikan pesan yang bisa dibaca pengguna di body respons.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const payload = await ctx.json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    throw error;
  }
  return data as T;
}

export interface NewCashierInput {
  name: string;
  email: string;
  password: string;
  role: Profile["role"];
  code?: string;
  pin?: string;
}

export function createCashier(input: NewCashierInput) {
  return invoke<{ user_id: string }>("admin-users", { action: "create", ...input });
}

export function resetCashierPin(userId: string, code: string, pin: string) {
  return invoke<{ ok: true }>("admin-users", { action: "set_pin", user_id: userId, code, pin });
}

export function resetCashierPassword(userId: string, password: string) {
  return invoke<{ ok: true }>("admin-users", { action: "set_password", user_id: userId, password });
}

export function deleteCashier(userId: string) {
  return invoke<{ ok: true }>("admin-users", { action: "delete", user_id: userId });
}

export interface ResetResult {
  tipe: ResetType;
  terhapus: Record<string, number>;
  auth_user_ids: string[];
}

export function resetData(type: ResetType, confirmation: string) {
  return invoke<ResetResult>("reset-data", { type, confirmation });
}
