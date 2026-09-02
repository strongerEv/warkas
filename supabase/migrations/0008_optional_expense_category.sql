-- ============================================================
-- WARKAS — 0008: `p_category_id` pada create_expense jadi opsional
--
-- Kolom expenses.category_id memang nullable ("Tanpa kategori"), tetapi
-- parameternya wajib sehingga client terpaksa mengirim null eksplisit.
-- Diberi DEFAULT null agar tanda tangannya jujur dan argumen bisa dilewat.
-- ============================================================

create or replace function public.create_expense(
  p_amount         numeric,
  p_category_id    uuid default null,
  p_note           text default null,
  p_expense_date   date default null,
  p_shift_id       uuid default null,
  p_receipt_url    text default null,
  p_payment_source public.payment_source default 'cash'
) returns public.expenses
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_profile public.profiles;
  v_store   public.stores;
  v_status  public.expense_status;
  v_sim     boolean;
  v_expense public.expenses;
begin
  select * into v_profile from public.profiles where id = auth.uid() and is_active;
  if v_profile.id is null then raise exception 'Akun tidak aktif'; end if;
  if v_profile.store_id is null then raise exception 'Akun belum terhubung ke toko'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;

  select * into v_store from public.stores where id = v_profile.store_id;

  -- Pengeluaran kasir di atas limit toko menunggu persetujuan admin.
  v_status := case
    when v_profile.role = 'admin' then 'approved'::public.expense_status
    when p_amount > v_store.cashier_expense_limit then 'pending'::public.expense_status
    else 'approved'::public.expense_status
  end;

  -- Ikut flag shift bila terhubung ke shift, selain itu ikut mode toko saat ini.
  if p_shift_id is not null then
    select is_simulation into v_sim from public.shifts where id = p_shift_id;
  end if;
  v_sim := coalesce(v_sim, v_store.simulation_mode, false);

  insert into public.expenses (
    store_id, shift_id, user_id, category_id, amount, note, receipt_url,
    expense_date, payment_source, status, approved_by, approved_at, is_simulation
  ) values (
    v_profile.store_id, p_shift_id, v_profile.id, p_category_id, p_amount,
    nullif(trim(coalesce(p_note, '')), ''), p_receipt_url,
    coalesce(p_expense_date, current_date), coalesce(p_payment_source, 'cash'), v_status,
    case when v_status = 'approved' then v_profile.id end,
    case when v_status = 'approved' then now() end,
    v_sim
  ) returning * into v_expense;

  return v_expense;
end $$;

revoke all on function public.create_expense(numeric, uuid, text, date, uuid, text, public.payment_source) from public, anon;
grant execute on function public.create_expense(numeric, uuid, text, date, uuid, text, public.payment_source) to authenticated;
