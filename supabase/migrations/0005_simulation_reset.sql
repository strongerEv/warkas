-- ============================================================
-- WARKAS — 0005: Generator data simulasi & Reset data
-- ============================================================

-- ---------- Generator data dummy ----------
-- Membuat katalog sandbox (kategori + produk ber-flag is_simulation), lalu
-- shift, transaksi, dan pengeluaran acak dengan pola jam ramai yang realistis.
create or replace function public.generate_simulation_data(
  p_days             integer default 30,
  p_trx_per_day_min  integer default 12,
  p_trx_per_day_max  integer default 35
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_store       uuid := public.my_store_id();
  v_tz          text;
  v_cat_makanan uuid;
  v_cat_minuman uuid;
  v_cat_snack   uuid;
  v_exp_cats    uuid[];
  v_users       uuid[];
  v_user        uuid;
  v_day         date;
  v_start_day   date;
  v_shift       uuid;
  v_trx         uuid;
  v_code        text;
  v_hour        integer;
  v_minute      integer;
  v_at          timestamptz;
  v_n_trx       integer;
  v_i           integer;
  v_j           integer;
  v_n_items     integer;
  v_product     record;
  v_qty         integer;
  v_line        numeric;
  v_subtotal    numeric;
  v_method      public.payment_method;
  v_opening     numeric;
  v_count_trx   integer := 0;
  v_count_exp   integer := 0;
  v_count_shift integer := 0;
  -- Bobot per jam 00..23: ramai saat makan siang (11-13) dan sore/malam (17-20).
  v_weights     integer[] := array[0,0,0,0,0,1,3,6,7,6,8,14,16,11,7,6,8,13,15,12,8,4,2,1];
  v_total_w     integer;
  v_pick        integer;
  v_acc         integer;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh membuat data simulasi'; end if;
  if v_store is null then raise exception 'Akun belum terhubung ke toko'; end if;
  p_days := greatest(least(coalesce(p_days, 30), 180), 1);

  select coalesce(timezone, 'Asia/Jakarta') into v_tz from public.stores where id = v_store;
  v_start_day := (now() at time zone v_tz)::date - (p_days - 1);

  -- --- Kategori sandbox ---
  insert into public.categories (store_id, name, color, sort_order, is_simulation) values
    (v_store, '[Simulasi] Makanan', '#f97316', 101, true),
    (v_store, '[Simulasi] Minuman', '#0ea5e9', 102, true),
    (v_store, '[Simulasi] Snack',   '#a855f7', 103, true)
  on conflict (store_id, name) do nothing;

  select id into v_cat_makanan from public.categories where store_id = v_store and name = '[Simulasi] Makanan';
  select id into v_cat_minuman from public.categories where store_id = v_store and name = '[Simulasi] Minuman';
  select id into v_cat_snack   from public.categories where store_id = v_store and name = '[Simulasi] Snack';

  -- --- Produk sandbox ---
  insert into public.products (store_id, category_id, name, price, stock, low_stock_threshold, sku, is_simulation)
  values
    (v_store, v_cat_makanan, 'Nasi Goreng Spesial', 18000, 500, 20, 'SIM-001', true),
    (v_store, v_cat_makanan, 'Mie Ayam Bakso',      15000, 500, 20, 'SIM-002', true),
    (v_store, v_cat_makanan, 'Ayam Geprek',         16000, 500, 20, 'SIM-003', true),
    (v_store, v_cat_makanan, 'Nasi Uduk',            8000, 500, 20, 'SIM-004', true),
    (v_store, v_cat_minuman, 'Es Teh Manis',         4000, 800, 30, 'SIM-005', true),
    (v_store, v_cat_minuman, 'Es Jeruk',             6000, 800, 30, 'SIM-006', true),
    (v_store, v_cat_minuman, 'Kopi Susu',           12000, 500, 20, 'SIM-007', true),
    (v_store, v_cat_minuman, 'Air Mineral',          3000, 800, 30, 'SIM-008', true),
    (v_store, v_cat_snack,   'Kerupuk',              2000, 600, 25, 'SIM-009', true),
    (v_store, v_cat_snack,   'Pisang Goreng',        7000, 400, 20, 'SIM-010', true),
    (v_store, v_cat_snack,   'Tahu Crispy',          6000, 400, 20, 'SIM-011', true),
    (v_store, v_cat_snack,   'Roti Bakar',          10000, 300, 15, 'SIM-012', true)
  on conflict (store_id, sku) do nothing;

  -- Isi ulang stok produk sandbox supaya generator tidak kehabisan stok.
  update public.products set stock = greatest(stock, 500)
   where store_id = v_store and is_simulation and sku like 'SIM-%';

  -- --- Kategori pengeluaran sandbox ---
  insert into public.expense_categories (store_id, name, color, is_simulation) values
    (v_store, '[Simulasi] Bahan Baku',    '#f97316', true),
    (v_store, '[Simulasi] Gaji',          '#0ea5e9', true),
    (v_store, '[Simulasi] Listrik & Air', '#eab308', true),
    (v_store, '[Simulasi] Sewa',          '#a855f7', true),
    (v_store, '[Simulasi] Lain-lain',     '#64748b', true)
  on conflict (store_id, name) do nothing;

  select array_agg(id) into v_exp_cats
    from public.expense_categories where store_id = v_store and is_simulation;

  -- Shift simulasi dibagikan ke user toko yang ada (Supabase Auth tidak
  -- mengizinkan membuat profil tanpa akun auth, jadi tidak ada user palsu).
  select array_agg(id) into v_users
    from public.profiles where store_id = v_store and is_active;
  if v_users is null or array_length(v_users, 1) = 0 then
    raise exception 'Tidak ada user aktif di toko ini';
  end if;

  v_total_w := (select sum(w) from unnest(v_weights) w);

  -- --- Loop harian ---
  for v_day in select generate_series(v_start_day, (now() at time zone v_tz)::date, interval '1 day')::date
  loop
    v_user    := v_users[1 + floor(random() * array_length(v_users, 1))::int];
    v_opening := (floor(random() * 6) + 2) * 50000;

    insert into public.shifts (store_id, user_id, opening_cash, status, opened_at, closed_at, is_simulation)
    values (
      v_store, v_user, v_opening,
      -- CASE dengan dua literal polos akan menghasilkan `text`, jadi enum-nya dicast eksplisit.
      case when v_day < (now() at time zone v_tz)::date
           then 'closed'::public.shift_status
           else 'open'::public.shift_status end,
      ((v_day + time '07:00') at time zone v_tz),
      case when v_day < (now() at time zone v_tz)::date
           then ((v_day + time '21:30') at time zone v_tz) end,
      true
    )
    -- shift terbuka milik user yang sama akan bentrok dengan unique index
    on conflict do nothing
    returning id into v_shift;

    if v_shift is null then continue; end if;
    v_count_shift := v_count_shift + 1;

    -- Akhir pekan lebih ramai.
    v_n_trx := p_trx_per_day_min
             + floor(random() * greatest(p_trx_per_day_max - p_trx_per_day_min, 1))::int;
    if extract(dow from v_day) in (0, 6) then
      v_n_trx := (v_n_trx * 1.4)::int;
    end if;

    for v_i in 1 .. v_n_trx loop
      -- Pilih jam berdasarkan bobot keramaian.
      v_pick := 1 + floor(random() * v_total_w)::int;
      v_acc := 0; v_hour := 12;
      for v_j in 1 .. 24 loop
        v_acc := v_acc + v_weights[v_j];
        if v_pick <= v_acc then v_hour := v_j - 1; exit; end if;
      end loop;
      v_minute := floor(random() * 60)::int;
      v_at := ((v_day + make_time(v_hour, v_minute, 0)) at time zone v_tz);
      if v_at > now() then continue; end if;

      v_code := 'SIM' || to_char(v_at at time zone v_tz, 'YYMMDD') || '-'
                || lpad(nextval('public.transaction_code_seq')::text, 4, '0');

      v_method := (array['cash','cash','cash','cash','qris','qris','transfer','other'])[
                    1 + floor(random() * 8)::int]::public.payment_method;

      insert into public.transactions (
        store_id, shift_id, user_id, code, payment_method, created_at, is_simulation
      ) values (v_store, v_shift, v_user, v_code, v_method, v_at, true)
      returning id into v_trx;

      v_subtotal := 0;
      v_n_items := 1 + floor(random() * 3)::int;

      for v_product in
        select * from public.products
         where store_id = v_store and is_simulation and is_active
         order by random() limit v_n_items
      loop
        v_qty  := 1 + floor(random() * 3)::int;
        v_line := v_product.price * v_qty;
        v_subtotal := v_subtotal + v_line;

        insert into public.transaction_items (
          transaction_id, product_id, product_name, qty, price_at_sale, subtotal
        ) values (v_trx, v_product.id, v_product.name, v_qty, v_product.price, v_line);

        update public.products set stock = greatest(stock - v_qty, 0) where id = v_product.id;

        insert into public.stock_logs (
          store_id, product_id, change_qty, stock_after, reason, reference_id,
          user_id, created_at, is_simulation
        ) select v_store, v_product.id, -v_qty, p.stock, 'sale', v_trx, v_user, v_at, true
            from public.products p where p.id = v_product.id;
      end loop;

      update public.transactions
         set subtotal = v_subtotal, total = v_subtotal,
             paid_amount = v_subtotal, change_amount = 0
       where id = v_trx;

      v_count_trx := v_count_trx + 1;
    end loop;

    -- --- Pengeluaran harian ---
    insert into public.expenses (
      store_id, shift_id, user_id, category_id, amount, note,
      expense_date, payment_source, status, approved_by, approved_at, created_at, is_simulation
    )
    select v_store, v_shift, v_user,
           v_exp_cats[1 + floor(random() * array_length(v_exp_cats, 1))::int],
           (floor(random() * 18) + 3) * 10000,
           'Pengeluaran simulasi',
           v_day, 'cash', 'approved', v_user,
           coalesce(v_at, ((v_day + time '08:00') at time zone v_tz)),
           ((v_day + time '08:00') at time zone v_tz), true
      from generate_series(1, 1 + floor(random() * 2)::int);

    get diagnostics v_j = row_count;
    v_count_exp := v_count_exp + v_j;

    -- Lengkapi angka tutup shift untuk hari yang sudah lewat, termasuk
    -- selisih kas kecil supaya laporan simulasi terasa realistis.
    if v_day < (now() at time zone v_tz)::date then
      update public.shifts s
         set expected_cash = public.shift_expected_cash(s.id),
             closing_cash  = public.shift_expected_cash(s.id)
                             + (floor(random() * 5) - 2) * 1000
       where s.id = v_shift;
    end if;

    v_shift := null;
  end loop;

  perform public.log_activity(
    v_store, 'simulation.generated',
    'Data simulasi ' || p_days || ' hari dibuat',
    jsonb_build_object('transaksi', v_count_trx, 'pengeluaran', v_count_exp, 'shift', v_count_shift)
  );

  return jsonb_build_object(
    'hari', p_days, 'shift', v_count_shift,
    'transaksi', v_count_trx, 'pengeluaran', v_count_exp
  );
end $$;

grant execute on function public.generate_simulation_data(integer, integer, integer) to authenticated;

-- ---------- Reset data ----------
-- Dipanggil Edge Function `reset-data` (yang memverifikasi JWT admin lebih dulu),
-- tapi tetap memeriksa hak akses sendiri sebagai lapis kedua.
create or replace function public.reset_data(
  p_type         public.reset_type,
  p_confirmation text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_store      uuid := public.my_store_id();
  v_store_name text;
  v_deleted    jsonb := '{}'::jsonb;
  v_n          integer;
  v_orphans    uuid[] := '{}';
begin
  if not public.is_admin() then raise exception 'Hanya admin yang boleh melakukan reset data'; end if;
  if v_store is null then raise exception 'Akun belum terhubung ke toko'; end if;

  select name into v_store_name from public.stores where id = v_store;

  -- Konfirmasi ganda: ketik nama toko, atau kata HAPUS.
  if upper(trim(coalesce(p_confirmation, ''))) <> 'HAPUS'
     and lower(trim(coalesce(p_confirmation, ''))) <> lower(v_store_name) then
    raise exception 'Konfirmasi tidak cocok. Ketik nama toko atau kata HAPUS.';
  end if;

  if p_type = 'simulation' then
    delete from public.stock_logs where store_id = v_store and is_simulation;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('stock_logs', v_n);

    delete from public.expenses where store_id = v_store and is_simulation;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('pengeluaran', v_n);

    -- transaction_items ikut terhapus lewat ON DELETE CASCADE
    delete from public.transactions where store_id = v_store and is_simulation;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('transaksi', v_n);

    delete from public.shifts where store_id = v_store and is_simulation;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('shift', v_n);

    delete from public.products where store_id = v_store and is_simulation;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('produk', v_n);

    delete from public.categories where store_id = v_store and is_simulation;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('kategori', v_n);

    delete from public.expense_categories where store_id = v_store and is_simulation;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('kategori_pengeluaran', v_n);

  elsif p_type in ('transactional', 'factory') then
    delete from public.stock_logs where store_id = v_store;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('stock_logs', v_n);

    delete from public.expenses where store_id = v_store;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('pengeluaran', v_n);

    delete from public.transactions where store_id = v_store;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('transaksi', v_n);

    delete from public.shifts where store_id = v_store;
    get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('shift', v_n);

    if p_type = 'factory' then
      delete from public.products where store_id = v_store;
      get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('produk', v_n);

      delete from public.categories where store_id = v_store;
      get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('kategori', v_n);

      delete from public.recurring_expenses where store_id = v_store;
      delete from public.expense_categories where store_id = v_store;
      get diagnostics v_n = row_count; v_deleted := v_deleted || jsonb_build_object('kategori_pengeluaran', v_n);

      -- Kumpulkan user non-admin; akun auth-nya dihapus oleh Edge Function
      -- (butuh service role), lalu baris profilnya ikut terhapus via cascade.
      select coalesce(array_agg(id), '{}') into v_orphans
        from public.profiles where store_id = v_store and id <> auth.uid();
      v_deleted := v_deleted || jsonb_build_object('user_dihapus', coalesce(array_length(v_orphans, 1), 0));

      update public.stores set simulation_mode = false where id = v_store;
    end if;
  else
    raise exception 'Jenis reset tidak dikenal';
  end if;

  perform public.log_activity(
    v_store, 'data.reset',
    'Reset data (' || p_type::text || ') dijalankan',
    v_deleted
  );

  return jsonb_build_object('tipe', p_type, 'terhapus', v_deleted, 'auth_user_ids', to_jsonb(v_orphans));
end $$;

grant execute on function public.reset_data(public.reset_type, text) to authenticated;
grant execute on function public.bootstrap_store(text, text) to authenticated;
