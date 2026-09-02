-- ============================================================
-- WARKAS — 0003: RPC inti
-- Semua penulisan data transaksional lewat sini (SECURITY DEFINER),
-- supaya is_simulation, potong stok, dan limit kasir ditentukan server.
-- ============================================================

-- ---------- Util ----------
create or replace function public.log_activity(
  p_store_id uuid, p_action text, p_description text, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.activity_logs (store_id, user_id, action_type, description, metadata)
  values (p_store_id, auth.uid(), p_action, p_description, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.store_timezone(p_store_id uuid)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(timezone, 'Asia/Jakarta') from public.stores where id = p_store_id
$$;

-- ---------- Profil otomatis saat user auth dibuat ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, name, email, role, store_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'kasir'),
    nullif(new.raw_user_meta_data ->> 'store_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Setup toko pertama kali ----------
-- Dipanggil user yang baru daftar dan belum punya toko. Dia menjadi admin.
create or replace function public.bootstrap_store(
  p_store_name text,
  p_address    text default null
) returns public.stores
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_store  public.stores;
  v_exists uuid;
begin
  if auth.uid() is null then
    raise exception 'Harus login terlebih dahulu';
  end if;
  if coalesce(trim(p_store_name), '') = '' then
    raise exception 'Nama toko wajib diisi';
  end if;

  select store_id into v_exists from public.profiles where id = auth.uid();
  if v_exists is not null then
    raise exception 'Akun ini sudah terhubung ke sebuah toko';
  end if;

  insert into public.stores (name, address)
  values (trim(p_store_name), nullif(trim(coalesce(p_address, '')), ''))
  returning * into v_store;

  update public.profiles
     set store_id = v_store.id, role = 'admin', is_active = true
   where id = auth.uid();

  -- Kategori produk bawaan
  insert into public.categories (store_id, name, color, sort_order) values
    (v_store.id, 'Makanan',  '#f97316', 1),
    (v_store.id, 'Minuman',  '#0ea5e9', 2),
    (v_store.id, 'Snack',    '#a855f7', 3),
    (v_store.id, 'Lainnya',  '#64748b', 4);

  -- Kategori pengeluaran bawaan
  insert into public.expense_categories (store_id, name, color) values
    (v_store.id, 'Bahan Baku',    '#f97316'),
    (v_store.id, 'Gaji',          '#0ea5e9'),
    (v_store.id, 'Listrik & Air', '#eab308'),
    (v_store.id, 'Sewa',          '#a855f7'),
    (v_store.id, 'Maintenance',   '#14b8a6'),
    (v_store.id, 'Lain-lain',     '#64748b');

  perform public.log_activity(v_store.id, 'store.created', 'Toko "' || v_store.name || '" dibuat');
  return v_store;
end $$;

-- ---------- PIN kasir ----------
create or replace function public.set_my_pin(p_code text, p_pin text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Harus login'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN harus 4-6 digit angka';
  end if;
  if coalesce(trim(p_code), '') = '' then
    raise exception 'Kode kasir wajib diisi';
  end if;

  update public.profiles
     set code = upper(trim(p_code)),
         pin_hash = crypt(p_pin, gen_salt('bf'))
   where id = auth.uid();
end $$;

grant execute on function public.set_my_pin(text, text) to authenticated;

-- Dipakai HANYA oleh Edge Function `pin-login` (service role).
-- Sengaja tidak di-grant ke anon/authenticated.
create or replace function public.verify_pin_login(p_code text, p_pin text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  select p.id, p.email
    from public.profiles p
   where p.code = upper(trim(p_code))
     and p.is_active
     and p.pin_hash is not null
     and p.pin_hash = crypt(p_pin, p.pin_hash)
   limit 1;
end $$;

revoke all on function public.verify_pin_login(text, text) from public, anon, authenticated;

-- ---------- Shift ----------
create or replace function public.open_shift(p_opening_cash numeric default 0)
returns public.shifts
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_profile public.profiles;
  v_sim     boolean;
  v_shift   public.shifts;
begin
  select * into v_profile from public.profiles where id = auth.uid() and is_active;
  if v_profile.id is null then raise exception 'Akun tidak aktif atau tidak ditemukan'; end if;
  if v_profile.store_id is null then raise exception 'Akun belum terhubung ke toko'; end if;
  if coalesce(p_opening_cash, 0) < 0 then raise exception 'Modal awal tidak boleh negatif'; end if;

  if exists (select 1 from public.shifts where user_id = v_profile.id and status = 'open') then
    raise exception 'Masih ada shift yang terbuka. Tutup dulu shift sebelumnya.';
  end if;

  select simulation_mode into v_sim from public.stores where id = v_profile.store_id;

  insert into public.shifts (store_id, user_id, opening_cash, is_simulation)
  values (v_profile.store_id, v_profile.id, coalesce(p_opening_cash, 0), coalesce(v_sim, false))
  returning * into v_shift;

  perform public.log_activity(
    v_profile.store_id, 'shift.opened',
    v_profile.name || ' membuka shift', jsonb_build_object('shift_id', v_shift.id, 'is_simulation', v_shift.is_simulation)
  );
  return v_shift;
end $$;

grant execute on function public.open_shift(numeric) to authenticated;

-- Hitung kas seharusnya: modal awal + penjualan tunai - pengeluaran tunai
create or replace function public.shift_expected_cash(p_shift_id uuid)
returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select s.opening_cash
       + coalesce((select sum(t.total) from public.transactions t
                    where t.shift_id = s.id and t.payment_method = 'cash'), 0)
       - coalesce((select sum(e.amount) from public.expenses e
                    where e.shift_id = s.id and e.payment_source = 'cash'
                      and e.status = 'approved'), 0)
    from public.shifts s where s.id = p_shift_id
$$;

grant execute on function public.shift_expected_cash(uuid) to authenticated;

create or replace function public.close_shift(
  p_shift_id     uuid,
  p_closing_cash numeric,
  p_note         text default null
) returns public.shifts
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shift    public.shifts;
  v_expected numeric;
begin
  select * into v_shift from public.shifts where id = p_shift_id for update;
  if v_shift.id is null then raise exception 'Shift tidak ditemukan'; end if;
  if v_shift.status = 'closed' then raise exception 'Shift sudah ditutup'; end if;
  if v_shift.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Hanya pemilik shift atau admin yang boleh menutup shift ini';
  end if;
  if coalesce(p_closing_cash, 0) < 0 then raise exception 'Kas fisik tidak boleh negatif'; end if;

  v_expected := public.shift_expected_cash(p_shift_id);

  update public.shifts
     set status        = 'closed',
         closing_cash  = coalesce(p_closing_cash, 0),
         expected_cash = v_expected,
         note          = p_note,
         closed_at     = now()
   where id = p_shift_id
  returning * into v_shift;

  perform public.log_activity(
    v_shift.store_id, 'shift.closed', 'Shift ditutup',
    jsonb_build_object('shift_id', v_shift.id, 'selisih', v_shift.difference)
  );
  return v_shift;
end $$;

grant execute on function public.close_shift(uuid, numeric, text) to authenticated;

-- ---------- Penjualan ----------
-- p_items: [{"product_id": uuid, "qty": int, "discount": numeric}]
-- Harga diambil dari database (bukan dari client) agar tidak bisa dimanipulasi.
create or replace function public.create_sale(
  p_shift_id       uuid,
  p_items          jsonb,
  p_discount       numeric default 0,
  p_payment_method public.payment_method default 'cash',
  p_paid_amount    numeric default null,
  p_note           text default null,
  p_client_ref     text default null,
  p_created_at     timestamptz default null
) returns public.transactions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shift    public.shifts;
  v_trx      public.transactions;
  v_item     jsonb;
  v_product  public.products;
  v_qty      integer;
  v_disc     numeric;
  v_line     numeric;
  v_subtotal numeric := 0;
  v_total    numeric;
  v_paid     numeric;
  v_tz       text;
  v_code     text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang masih kosong';
  end if;

  -- Idempotensi: transaksi offline yang ter-sync dua kali tidak digandakan.
  if p_client_ref is not null then
    select * into v_trx from public.transactions where client_ref = p_client_ref;
    if v_trx.id is not null then return v_trx; end if;
  end if;

  select * into v_shift from public.shifts where id = p_shift_id for update;
  if v_shift.id is null then raise exception 'Shift tidak ditemukan'; end if;
  if v_shift.status <> 'open' then raise exception 'Shift sudah ditutup, tidak bisa menambah transaksi'; end if;
  if v_shift.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Tidak berhak menambah transaksi pada shift ini';
  end if;

  select coalesce(timezone, 'Asia/Jakarta') into v_tz from public.stores where id = v_shift.store_id;
  v_code := 'TRX' || to_char(now() at time zone v_tz, 'YYMMDD') || '-'
            || lpad(nextval('public.transaction_code_seq')::text, 4, '0');

  insert into public.transactions (
    store_id, shift_id, user_id, code, client_ref, discount,
    payment_method, note, is_simulation, created_at
  ) values (
    v_shift.store_id, v_shift.id, v_shift.user_id, v_code, p_client_ref, greatest(coalesce(p_discount, 0), 0),
    coalesce(p_payment_method, 'cash'), p_note, v_shift.is_simulation, coalesce(p_created_at, now())
  ) returning * into v_trx;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty  := coalesce((v_item ->> 'qty')::integer, 0);
    v_disc := greatest(coalesce((v_item ->> 'discount')::numeric, 0), 0);
    if v_qty <= 0 then raise exception 'Jumlah item harus lebih dari 0'; end if;

    select * into v_product from public.products
     where id = (v_item ->> 'product_id')::uuid for update;

    if v_product.id is null then raise exception 'Produk tidak ditemukan'; end if;
    if v_product.store_id <> v_shift.store_id then raise exception 'Produk bukan milik toko ini'; end if;

    -- Pemisahan sandbox: shift simulasi hanya boleh menjual produk simulasi,
    -- dan sebaliknya. Ini yang menjaga stok asli tidak pernah terpotong saat demo.
    if v_product.is_simulation <> v_shift.is_simulation then
      raise exception 'Produk "%" tidak tersedia pada mode ini', v_product.name;
    end if;

    if v_product.track_stock and v_product.stock < v_qty then
      raise exception 'Stok "%" tidak cukup (sisa %)', v_product.name, v_product.stock;
    end if;

    v_line := (v_product.price * v_qty) - v_disc;
    if v_line < 0 then raise exception 'Diskon item melebihi harga item'; end if;
    v_subtotal := v_subtotal + v_line;

    insert into public.transaction_items (
      transaction_id, product_id, product_name, qty, price_at_sale, discount, subtotal
    ) values (v_trx.id, v_product.id, v_product.name, v_qty, v_product.price, v_disc, v_line);

    if v_product.track_stock then
      update public.products set stock = stock - v_qty where id = v_product.id;
      insert into public.stock_logs (
        store_id, product_id, change_qty, stock_after, reason, reference_id, user_id, is_simulation
      ) values (
        v_shift.store_id, v_product.id, -v_qty, v_product.stock - v_qty, 'sale',
        v_trx.id, v_shift.user_id, v_shift.is_simulation
      );
    end if;
  end loop;

  v_total := v_subtotal - v_trx.discount;
  if v_total < 0 then raise exception 'Diskon transaksi melebihi total belanja'; end if;

  -- Non-tunai selalu dianggap dibayar pas, tidak ada kembalian.
  v_paid := case when coalesce(p_payment_method, 'cash') = 'cash'
                 then greatest(coalesce(p_paid_amount, v_total), v_total)
                 else v_total end;

  update public.transactions
     set subtotal = v_subtotal, total = v_total,
         paid_amount = v_paid, change_amount = v_paid - v_total
   where id = v_trx.id
  returning * into v_trx;

  return v_trx;
end $$;

grant execute on function public.create_sale(uuid, jsonb, numeric, public.payment_method, numeric, text, text, timestamptz) to authenticated;

-- ---------- Batalkan transaksi (admin) ----------
create or replace function public.void_transaction(p_transaction_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_trx  public.transactions;
  v_item record;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh membatalkan transaksi'; end if;

  select * into v_trx from public.transactions where id = p_transaction_id for update;
  if v_trx.id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if v_trx.store_id <> public.my_store_id() then raise exception 'Transaksi bukan milik toko ini'; end if;

  -- Kembalikan stok setiap item sebelum transaksi dihapus.
  for v_item in
    select ti.product_id, ti.qty, p.track_stock, p.stock
      from public.transaction_items ti
      join public.products p on p.id = ti.product_id
     where ti.transaction_id = v_trx.id
  loop
    if v_item.track_stock then
      update public.products set stock = stock + v_item.qty where id = v_item.product_id;
      insert into public.stock_logs (
        store_id, product_id, change_qty, stock_after, reason, reference_id, user_id, note, is_simulation
      ) values (
        v_trx.store_id, v_item.product_id, v_item.qty, v_item.stock + v_item.qty, 'void',
        v_trx.id, auth.uid(), p_reason, v_trx.is_simulation
      );
    end if;
  end loop;

  delete from public.transactions where id = v_trx.id;

  perform public.log_activity(
    v_trx.store_id, 'transaction.voided',
    'Transaksi ' || v_trx.code || ' dibatalkan',
    jsonb_build_object('total', v_trx.total, 'reason', p_reason)
  );
end $$;

grant execute on function public.void_transaction(uuid, text) to authenticated;

-- ---------- Penyesuaian stok manual (admin) ----------
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_change_qty integer,
  p_reason     public.stock_reason default 'adjustment',
  p_note       text default null
) returns public.products
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_product public.products;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh menyesuaikan stok'; end if;
  if coalesce(p_change_qty, 0) = 0 then raise exception 'Jumlah perubahan tidak boleh 0'; end if;

  select * into v_product from public.products where id = p_product_id for update;
  if v_product.id is null then raise exception 'Produk tidak ditemukan'; end if;
  if v_product.store_id <> public.my_store_id() then raise exception 'Produk bukan milik toko ini'; end if;
  if v_product.stock + p_change_qty < 0 then raise exception 'Stok tidak boleh menjadi negatif'; end if;

  update public.products set stock = stock + p_change_qty
   where id = p_product_id returning * into v_product;

  insert into public.stock_logs (
    store_id, product_id, change_qty, stock_after, reason, user_id, note, is_simulation
  ) values (
    v_product.store_id, v_product.id, p_change_qty, v_product.stock, p_reason,
    auth.uid(), p_note, v_product.is_simulation
  );

  return v_product;
end $$;

grant execute on function public.adjust_stock(uuid, integer, public.stock_reason, text) to authenticated;

-- ---------- Pengeluaran ----------
create or replace function public.create_expense(
  p_amount         numeric,
  p_category_id    uuid,
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

grant execute on function public.create_expense(numeric, uuid, text, date, uuid, text, public.payment_source) to authenticated;

create or replace function public.review_expense(p_expense_id uuid, p_approve boolean)
returns public.expenses
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_expense public.expenses;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh menyetujui pengeluaran'; end if;

  update public.expenses
     set status      = case when p_approve then 'approved'::public.expense_status
                                           else 'rejected'::public.expense_status end,
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_expense_id and store_id = public.my_store_id()
  returning * into v_expense;

  if v_expense.id is null then raise exception 'Pengeluaran tidak ditemukan'; end if;

  perform public.log_activity(
    v_expense.store_id,
    case when p_approve then 'expense.approved' else 'expense.rejected' end,
    'Pengeluaran ' || v_expense.amount::text || ' ditinjau admin',
    jsonb_build_object('expense_id', v_expense.id)
  );
  return v_expense;
end $$;

grant execute on function public.review_expense(uuid, boolean) to authenticated;

create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_expense public.expenses;
begin
  select * into v_expense from public.expenses where id = p_expense_id;
  if v_expense.id is null then raise exception 'Pengeluaran tidak ditemukan'; end if;
  if v_expense.store_id <> public.my_store_id() then raise exception 'Bukan milik toko ini'; end if;

  -- Kasir hanya boleh menghapus pengeluarannya sendiri yang belum disetujui.
  if not public.is_admin() then
    if v_expense.user_id <> auth.uid() or v_expense.status = 'approved' then
      raise exception 'Tidak berhak menghapus pengeluaran ini';
    end if;
  end if;

  delete from public.expenses where id = p_expense_id;
end $$;

grant execute on function public.delete_expense(uuid) to authenticated;

-- ---------- Mode simulasi ----------
create or replace function public.set_simulation_mode(p_enabled boolean)
returns public.stores
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_store public.stores;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh mengubah mode simulasi'; end if;

  update public.stores set simulation_mode = coalesce(p_enabled, false)
   where id = public.my_store_id() returning * into v_store;

  perform public.log_activity(
    v_store.id, 'simulation.toggled',
    case when p_enabled then 'Mode simulasi diaktifkan' else 'Mode simulasi dimatikan' end
  );
  return v_store;
end $$;

grant execute on function public.set_simulation_mode(boolean) to authenticated;
