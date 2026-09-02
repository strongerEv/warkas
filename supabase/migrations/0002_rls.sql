-- ============================================================
-- WARKAS — 0002: Row Level Security
--
-- Prinsip:
--  * Data master (produk, kategori, toko)  -> baca semua user toko, tulis admin.
--  * Data transaksional (shift, transaksi, pengeluaran, stok)
--    -> hanya BACA lewat policy. Semua penulisan wajib lewat RPC
--       SECURITY DEFINER di 0003 supaya flag is_simulation, potong stok,
--       dan limit pengeluaran kasir ditentukan server, bukan client.
-- ============================================================

-- ---------- Helper (SECURITY DEFINER, menghindari rekursi policy) ----------
create or replace function public.my_profile()
returns public.profiles
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.profiles where id = auth.uid()
$$;

create or replace function public.my_store_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select store_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  )
$$;

create or replace function public.is_active_member()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active)
$$;

grant execute on function public.my_profile()       to authenticated;
grant execute on function public.my_store_id()      to authenticated;
grant execute on function public.is_admin()         to authenticated;
grant execute on function public.is_active_member() to authenticated;

-- ---------- Aktifkan RLS ----------
alter table public.stores             enable row level security;
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.shifts             enable row level security;
alter table public.transactions       enable row level security;
alter table public.transaction_items  enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses           enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.stock_logs         enable row level security;
alter table public.activity_logs      enable row level security;

-- ---------- stores ----------
drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores
  for select to authenticated
  using (id = public.my_store_id());

drop policy if exists stores_update on public.stores;
create policy stores_update on public.stores
  for update to authenticated
  using (id = public.my_store_id() and public.is_admin())
  with check (id = public.my_store_id() and public.is_admin());

-- ---------- profiles ----------
-- Semua anggota toko boleh membaca nama rekan (dipakai di laporan & riwayat shift),
-- tetapi kolom pin_hash tidak pernah dikirim ke client (lihat view profiles_public).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or store_id = public.my_store_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for update to authenticated
  using (store_id = public.my_store_id() and public.is_admin())
  with check (store_id = public.my_store_id() and public.is_admin());

-- ---------- categories ----------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (store_id = public.my_store_id());

drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all on public.categories
  for all to authenticated
  using (store_id = public.my_store_id() and public.is_admin())
  with check (store_id = public.my_store_id() and public.is_admin());

-- ---------- products ----------
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated using (store_id = public.my_store_id());

drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all to authenticated
  using (store_id = public.my_store_id() and public.is_admin())
  with check (store_id = public.my_store_id() and public.is_admin());

-- ---------- expense_categories ----------
drop policy if exists expense_categories_select on public.expense_categories;
create policy expense_categories_select on public.expense_categories
  for select to authenticated using (store_id = public.my_store_id());

drop policy if exists expense_categories_admin_all on public.expense_categories;
create policy expense_categories_admin_all on public.expense_categories
  for all to authenticated
  using (store_id = public.my_store_id() and public.is_admin())
  with check (store_id = public.my_store_id() and public.is_admin());

-- ---------- recurring_expenses (admin only) ----------
drop policy if exists recurring_expenses_admin_all on public.recurring_expenses;
create policy recurring_expenses_admin_all on public.recurring_expenses
  for all to authenticated
  using (store_id = public.my_store_id() and public.is_admin())
  with check (store_id = public.my_store_id() and public.is_admin());

-- ---------- shifts (baca saja; tulis lewat RPC) ----------
drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts
  for select to authenticated
  using (
    store_id = public.my_store_id()
    and (public.is_admin() or user_id = auth.uid())
  );

-- ---------- transactions ----------
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (
    store_id = public.my_store_id()
    and (public.is_admin() or user_id = auth.uid())
  );

-- ---------- transaction_items (ikut hak baca transaksi induk) ----------
drop policy if exists transaction_items_select on public.transaction_items;
create policy transaction_items_select on public.transaction_items
  for select to authenticated
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id
      and t.store_id = public.my_store_id()
      and (public.is_admin() or t.user_id = auth.uid())
  ));

-- ---------- expenses ----------
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    store_id = public.my_store_id()
    and (public.is_admin() or user_id = auth.uid())
  );

-- ---------- stock_logs ----------
drop policy if exists stock_logs_select on public.stock_logs;
create policy stock_logs_select on public.stock_logs
  for select to authenticated using (store_id = public.my_store_id());

-- ---------- activity_logs (admin only) ----------
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (store_id = public.my_store_id() and public.is_admin());

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists product_images_admin_write on storage.objects;
create policy product_images_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- Foto struk pengeluaran: kasir boleh unggah & baca miliknya, admin baca semua.
drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (public.is_admin() or owner = auth.uid())
  );

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_active_member());

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (public.is_admin() or owner = auth.uid()));
