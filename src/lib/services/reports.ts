import { supabase } from "@/lib/supabase/client";
import type { ActivityLog, ComparePeriods, DashboardReport } from "@/lib/types";

/**
 * Semua laporan lewat RPC yang memfilter `is_simulation` di sisi database.
 * Kasir otomatis dibatasi ke datanya sendiri oleh RPC, apa pun yang dikirim UI.
 */
export async function dashboardReport(
  from: Date,
  to: Date,
  sim: boolean,
  userId?: string | null,
): Promise<DashboardReport> {
  const { data, error } = await supabase().rpc("report_dashboard", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_simulation: sim,
    p_user_id: userId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as DashboardReport;
}

export async function compareReport(
  from: Date,
  to: Date,
  sim: boolean,
  userId?: string | null,
): Promise<ComparePeriods> {
  const { data, error } = await supabase().rpc("report_compare", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_simulation: sim,
    p_user_id: userId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ComparePeriods;
}

export async function listActivityLogs(limit = 100): Promise<ActivityLog[]> {
  const { data, error } = await supabase()
    .from("activity_logs")
    .select("*, user:profiles(id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ActivityLog[];
}
