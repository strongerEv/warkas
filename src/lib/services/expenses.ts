import { supabase } from "@/lib/supabase/client";
import type { Expense, PaymentSource, RecurringExpense } from "@/lib/types";

export async function listExpenses(
  sim: boolean,
  opts?: { from?: string; to?: string; shiftId?: string; limit?: number },
): Promise<Expense[]> {
  let query = supabase()
    .from("expenses")
    .select("*, category:expense_categories(id, name, color), user:profiles!expenses_user_id_fkey(id, name)")
    .eq("is_simulation", sim)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);

  if (opts?.from) query = query.gte("expense_date", opts.from);
  if (opts?.to) query = query.lte("expense_date", opts.to);
  if (opts?.shiftId) query = query.eq("shift_id", opts.shiftId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Expense[];
}

export interface ExpenseInput {
  amount: number;
  categoryId: string | null;
  note?: string;
  expenseDate?: string;
  shiftId?: string | null;
  receiptUrl?: string | null;
  paymentSource?: PaymentSource;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase().rpc("create_expense", {
    p_amount: input.amount,
    p_category_id: input.categoryId ?? undefined,
    p_note: input.note ?? undefined,
    p_expense_date: input.expenseDate ?? undefined,
    p_shift_id: input.shiftId ?? undefined,
    p_receipt_url: input.receiptUrl ?? undefined,
    p_payment_source: input.paymentSource ?? "cash",
  });
  if (error) throw error;
  return data as unknown as Expense;
}

export async function reviewExpense(id: string, approve: boolean) {
  const { error } = await supabase().rpc("review_expense", {
    p_expense_id: id,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase().rpc("delete_expense", { p_expense_id: id });
  if (error) throw error;
}

/* ---------------- Pengeluaran berulang ---------------- */

export async function listRecurring(): Promise<RecurringExpense[]> {
  const { data, error } = await supabase()
    .from("recurring_expenses")
    .select("*, category:expense_categories(id, name, color)")
    .order("next_due_date");
  if (error) throw error;
  return (data ?? []) as unknown as RecurringExpense[];
}

export async function saveRecurring(
  input: Partial<RecurringExpense> & { name: string; amount: number },
  storeId: string,
) {
  const payload = {
    name: input.name.trim(),
    amount: Number(input.amount),
    category_id: input.category_id || null,
    frequency: input.frequency ?? "monthly",
    day_of_period: Number(input.day_of_period ?? 1),
    next_due_date: input.next_due_date ?? new Date().toISOString().slice(0, 10),
    is_active: input.is_active ?? true,
  };

  const query = input.id
    ? supabase().from("recurring_expenses").update(payload).eq("id", input.id)
    : supabase().from("recurring_expenses").insert({ ...payload, store_id: storeId });

  const { error } = await query;
  if (error) throw error;
}

export async function deleteRecurring(id: string) {
  const { error } = await supabase().from("recurring_expenses").delete().eq("id", id);
  if (error) throw error;
}

/** Catat pengeluaran berulang sebagai pengeluaran nyata, lalu majukan jatuh temponya. */
export async function postRecurring(item: RecurringExpense) {
  await createExpense({
    amount: item.amount,
    categoryId: item.category_id,
    note: `${item.name} (rutin)`,
    expenseDate: item.next_due_date,
    paymentSource: "non_cash",
  });

  const next = new Date(`${item.next_due_date}T00:00:00`);
  if (item.frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + 7);

  const { error } = await supabase()
    .from("recurring_expenses")
    .update({ next_due_date: next.toISOString().slice(0, 10) })
    .eq("id", item.id);
  if (error) throw error;
}
