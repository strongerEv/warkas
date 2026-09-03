-- ============================================================
-- WARKAS — 0010: HPP (modal barang), laba kotor & laba bersih
--
-- Sebelum ini laporan hanya mengurangi pengeluaran operasional dari omzet,
-- sehingga modal barang yang terjual tidak pernah masuk hitungan. Angkanya
-- karena itu terlalu optimistis untuk toko yang menjual barang.
--
-- Susunan barunya:
--   Laba kotor  = Omzet − HPP
--   Laba bersih = Laba kotor − Pengeluaran operasional
--
-- HPP disimpan ulang per item saat transaksi (cost_at_sale), bukan dibaca
-- dari produk saat laporan dibuka. Kalau harga modal naik bulan depan,
-- laporan bulan lalu tetap memakai modal yang berlaku saat itu.
-- ============================================================

alter table public.products
  add column if not exists cost_price numeric(14,2) not null default 0
    check (cost_price >= 0);

comment on column public.products.cost_price is
  'Harga pokok / modal per unit. Dipakai menghitung laba kotor.';

alter table public.transaction_items
  add column if not exists cost_at_sale numeric(14,2) not null default 0;

comment on column public.transaction_items.cost_at_sale is
  'Salinan cost_price produk saat transaksi terjadi, supaya laporan lama tidak berubah saat modal diperbarui.';

-- ---------- create_sale: ikut menyimpan modal per item ----------
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
      transaction_id, product_id, product_name, qty, price_at_sale, cost_at_sale, discount, subtotal
    ) values (
      v_trx.id, v_product.id, v_product.name, v_qty,
      v_product.price, v_product.cost_price, v_disc, v_line
    );

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

revoke all on function public.create_sale(uuid, jsonb, numeric, public.payment_method, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.create_sale(uuid, jsonb, numeric, public.payment_method, numeric, text, text, timestamptz) to authenticated;

-- ---------- Laporan dashboard: HPP, laba kotor, margin ----------
create or replace function public.report_dashboard(
  p_from       timestamptz,
  p_to         timestamptz,
  p_simulation boolean default false,
  p_user_id    uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_store uuid := public.my_store_id();
  v_admin boolean := public.is_admin();
  v_user  uuid;
  v_tz    text;
  v_sim   boolean := coalesce(p_simulation, false);
  v_res   jsonb;
begin
  if v_store is null then raise exception 'Akun belum terhubung ke toko'; end if;

  -- Kasir dikunci ke datanya sendiri, apa pun yang dikirim client.
  v_user := case when v_admin then p_user_id else auth.uid() end;
  select coalesce(timezone, 'Asia/Jakarta') into v_tz from public.stores where id = v_store;

  with trx as (
    select t.*
      from public.transactions t
     where t.store_id = v_store
       and t.is_simulation = v_sim
       and t.created_at >= p_from and t.created_at < p_to
       and (v_user is null or t.user_id = v_user)
  ),
  exp as (
    select e.*
      from public.expenses e
     where e.store_id = v_store
       and e.is_simulation = v_sim
       and e.status = 'approved'
       and e.expense_date >= (p_from at time zone v_tz)::date
       and e.expense_date <= ((p_to at time zone v_tz) - interval '1 microsecond')::date
       and (v_user is null or e.user_id = v_user)
  ),
  items as (
    select ti.*, (ti.qty * ti.cost_at_sale) as modal,
           (t.created_at at time zone v_tz)::date as tanggal
      from public.transaction_items ti
      join trx t on t.id = ti.transaction_id
  ),
  totals as (
    select coalesce((select sum(total)    from trx), 0)  as omzet,
           coalesce((select count(*)      from trx), 0)  as jumlah_transaksi,
           coalesce((select sum(discount) from trx), 0)  as total_diskon,
           coalesce((select sum(modal)    from items), 0) as hpp,
           coalesce((select sum(amount)   from exp), 0)  as pengeluaran,
           -- Item yang terjual tanpa modal terisi. Dipakai UI untuk memberi tahu
           -- bahwa angka laba kotor masih terlalu optimistis.
           coalesce((select count(*) from items where cost_at_sale = 0), 0) as item_tanpa_hpp
  ),
  trend as (
    select d::date as tanggal,
           coalesce((select sum(t.total) from trx t
                      where (t.created_at at time zone v_tz)::date = d::date), 0) as omzet,
           coalesce((select count(*) from trx t
                      where (t.created_at at time zone v_tz)::date = d::date), 0) as transaksi,
           coalesce((select sum(i.modal) from items i where i.tanggal = d::date), 0) as hpp,
           coalesce((select sum(e.amount) from exp e where e.expense_date = d::date), 0) as pengeluaran
      from generate_series(
             (p_from at time zone v_tz)::date,
             ((p_to at time zone v_tz) - interval '1 microsecond')::date,
             interval '1 day') d
  ),
  top_products as (
    select coalesce(i.product_name, 'Tanpa nama') as nama,
           sum(i.qty)::int        as qty,
           sum(i.subtotal)        as omzet,
           sum(i.modal)           as hpp,
           sum(i.subtotal) - sum(i.modal) as laba
      from items i
     group by 1 order by qty desc, omzet desc limit 10
  ),
  by_profit as (
    select coalesce(i.product_name, 'Tanpa nama') as nama,
           sum(i.qty)::int        as qty,
           sum(i.subtotal)        as omzet,
           sum(i.subtotal) - sum(i.modal) as laba
      from items i
     group by 1 order by laba desc limit 10
  ),
  hourly as (
    select h as jam,
           coalesce((select count(*) from trx t
                      where extract(hour from (t.created_at at time zone v_tz)) = h), 0) as transaksi,
           coalesce((select sum(t.total) from trx t
                      where extract(hour from (t.created_at at time zone v_tz)) = h), 0) as omzet
      from generate_series(0, 23) h
  ),
  payments as (
    select t.payment_method::text as metode, sum(t.total) as total, count(*)::int as jumlah
      from trx t group by 1 order by total desc
  ),
  expense_cats as (
    select coalesce(ec.name, 'Tanpa kategori') as kategori,
           coalesce(ec.color, '#64748b')       as warna,
           sum(e.amount)                       as total
      from exp e left join public.expense_categories ec on ec.id = e.category_id
     group by 1, 2 order by total desc
  )
  select jsonb_build_object(
    'omzet',            (select omzet from totals),
    'hpp',              (select hpp from totals),
    'laba_kotor',       (select omzet - hpp from totals),
    'jumlah_transaksi', (select jumlah_transaksi from totals),
    'total_diskon',     (select total_diskon from totals),
    'pengeluaran',      (select pengeluaran from totals),
    'laba_bersih',      (select omzet - hpp - pengeluaran from totals),
    'margin_kotor',     (select case when omzet > 0
                                     then round((omzet - hpp) / omzet * 100, 1) else 0 end from totals),
    'margin_bersih',    (select case when omzet > 0
                                     then round((omzet - hpp - pengeluaran) / omzet * 100, 1) else 0 end from totals),
    'item_tanpa_hpp',   (select item_tanpa_hpp from totals),
    'rata_transaksi',   (select case when jumlah_transaksi > 0
                                     then round(omzet / jumlah_transaksi, 2) else 0 end from totals),
    'tren',             coalesce((select jsonb_agg(to_jsonb(t) order by t.tanggal) from trend t), '[]'::jsonb),
    'produk_terlaris',  coalesce((select jsonb_agg(to_jsonb(p)) from top_products p), '[]'::jsonb),
    'produk_terlaba',   coalesce((select jsonb_agg(to_jsonb(p)) from by_profit p), '[]'::jsonb),
    'per_jam',          coalesce((select jsonb_agg(to_jsonb(h) order by h.jam) from hourly h), '[]'::jsonb),
    'metode_bayar',     coalesce((select jsonb_agg(to_jsonb(p)) from payments p), '[]'::jsonb),
    'kategori_pengeluaran', coalesce((select jsonb_agg(to_jsonb(c)) from expense_cats c), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

revoke all on function public.report_dashboard(timestamptz, timestamptz, boolean, uuid) from public, anon;
grant execute on function public.report_dashboard(timestamptz, timestamptz, boolean, uuid) to authenticated;

-- ---------- Perbandingan periode: ikut membandingkan laba kotor ----------
create or replace function public.report_compare(
  p_from       timestamptz,
  p_to         timestamptz,
  p_simulation boolean default false,
  p_user_id    uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_len      interval := p_to - p_from;
  v_current  jsonb;
  v_previous jsonb;
begin
  v_current  := public.report_dashboard(p_from, p_to, p_simulation, p_user_id);
  v_previous := public.report_dashboard(p_from - v_len, p_from, p_simulation, p_user_id);

  return jsonb_build_object(
    'sekarang', jsonb_build_object(
      'omzet',            v_current -> 'omzet',
      'hpp',              v_current -> 'hpp',
      'laba_kotor',       v_current -> 'laba_kotor',
      'pengeluaran',      v_current -> 'pengeluaran',
      'laba_bersih',      v_current -> 'laba_bersih',
      'jumlah_transaksi', v_current -> 'jumlah_transaksi'),
    'sebelumnya', jsonb_build_object(
      'omzet',            v_previous -> 'omzet',
      'hpp',              v_previous -> 'hpp',
      'laba_kotor',       v_previous -> 'laba_kotor',
      'pengeluaran',      v_previous -> 'pengeluaran',
      'laba_bersih',      v_previous -> 'laba_bersih',
      'jumlah_transaksi', v_previous -> 'jumlah_transaksi')
  );
end $$;

revoke all on function public.report_compare(timestamptz, timestamptz, boolean, uuid) from public, anon;
grant execute on function public.report_compare(timestamptz, timestamptz, boolean, uuid) to authenticated;

-- ---------- Ringkasan shift: ikut menampilkan modal & laba kotor ----------
create or replace function public.shift_report(p_shift_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_shift public.shifts;
  v_res   jsonb;
begin
  select * into v_shift from public.shifts where id = p_shift_id;
  if v_shift.id is null then raise exception 'Shift tidak ditemukan'; end if;
  if v_shift.store_id <> public.my_store_id() then raise exception 'Shift bukan milik toko ini'; end if;
  if v_shift.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Tidak berhak melihat shift ini';
  end if;

  select jsonb_build_object(
    'shift',        to_jsonb(v_shift),
    'kasir',        (select name from public.profiles where id = v_shift.user_id),
    'omzet',        coalesce((select sum(total) from public.transactions where shift_id = v_shift.id), 0),
    'hpp',          coalesce((select sum(ti.qty * ti.cost_at_sale)
                                from public.transaction_items ti
                                join public.transactions t on t.id = ti.transaction_id
                               where t.shift_id = v_shift.id), 0),
    'laba_kotor',   coalesce((select sum(total) from public.transactions where shift_id = v_shift.id), 0)
                    - coalesce((select sum(ti.qty * ti.cost_at_sale)
                                  from public.transaction_items ti
                                  join public.transactions t on t.id = ti.transaction_id
                                 where t.shift_id = v_shift.id), 0),
    'jumlah_transaksi', coalesce((select count(*) from public.transactions where shift_id = v_shift.id), 0),
    'penjualan_tunai',  coalesce((select sum(total) from public.transactions
                                   where shift_id = v_shift.id and payment_method = 'cash'), 0),
    'pengeluaran_tunai', coalesce((select sum(amount) from public.expenses
                                    where shift_id = v_shift.id and payment_source = 'cash'
                                      and status = 'approved'), 0),
    'pengeluaran_total', coalesce((select sum(amount) from public.expenses
                                    where shift_id = v_shift.id and status = 'approved'), 0),
    'kas_seharusnya', public.shift_expected_cash(v_shift.id),
    'metode_bayar', coalesce((
      select jsonb_agg(x) from (
        select payment_method::text as metode, sum(total) as total, count(*)::int as jumlah
          from public.transactions where shift_id = v_shift.id
         group by 1 order by 2 desc) x), '[]'::jsonb),
    'produk', coalesce((
      select jsonb_agg(x) from (
        select ti.product_name as nama, sum(ti.qty)::int as qty,
               sum(ti.subtotal) as omzet,
               sum(ti.subtotal) - sum(ti.qty * ti.cost_at_sale) as laba
          from public.transaction_items ti
          join public.transactions t on t.id = ti.transaction_id
         where t.shift_id = v_shift.id
         group by 1 order by 2 desc) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

revoke all on function public.shift_report(uuid) from public, anon;
grant execute on function public.shift_report(uuid) to authenticated;

-- ---------- Produk simulasi ikut punya modal yang masuk akal ----------
-- Dijalankan untuk katalog sandbox yang mungkin sudah dibuat sebelum kolom ini ada.
update public.products p
   set cost_price = v.modal
  from (values
    ('SIM-001', 11000), ('SIM-002',  9000), ('SIM-003', 10000), ('SIM-004', 4500),
    ('SIM-005',  1500), ('SIM-006',  2500), ('SIM-007',  5000), ('SIM-008', 2000),
    ('SIM-009',  1000), ('SIM-010',  3000), ('SIM-011',  2500), ('SIM-012', 4500)
  ) as v(sku, modal)
 where p.sku = v.sku and p.is_simulation and p.cost_price = 0;

-- ---------- Generator simulasi ikut mengisi modal ----------
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
  -- Modal dipatok sekitar 40-60% harga jual, meniru margin warung pada umumnya.
  insert into public.products (store_id, category_id, name, price, cost_price, stock, low_stock_threshold, sku, is_simulation)
  values
    (v_store, v_cat_makanan, 'Nasi Goreng Spesial', 18000, 11000, 500, 20, 'SIM-001', true),
    (v_store, v_cat_makanan, 'Mie Ayam Bakso',      15000,  9000, 500, 20, 'SIM-002', true),
    (v_store, v_cat_makanan, 'Ayam Geprek',         16000, 10000, 500, 20, 'SIM-003', true),
    (v_store, v_cat_makanan, 'Nasi Uduk',            8000,  4500, 500, 20, 'SIM-004', true),
    (v_store, v_cat_minuman, 'Es Teh Manis',         4000,  1500, 800, 30, 'SIM-005', true),
    (v_store, v_cat_minuman, 'Es Jeruk',             6000,  2500, 800, 30, 'SIM-006', true),
    (v_store, v_cat_minuman, 'Kopi Susu',           12000,  5000, 500, 20, 'SIM-007', true),
    (v_store, v_cat_minuman, 'Air Mineral',          3000,  2000, 800, 30, 'SIM-008', true),
    (v_store, v_cat_snack,   'Kerupuk',              2000,  1000, 600, 25, 'SIM-009', true),
    (v_store, v_cat_snack,   'Pisang Goreng',        7000,  3000, 400, 20, 'SIM-010', true),
    (v_store, v_cat_snack,   'Tahu Crispy',          6000,  2500, 400, 20, 'SIM-011', true),
    (v_store, v_cat_snack,   'Roti Bakar',          10000,  4500, 300, 15, 'SIM-012', true)
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
          transaction_id, product_id, product_name, qty, price_at_sale, cost_at_sale, subtotal
        ) values (v_trx, v_product.id, v_product.name, v_qty,
                  v_product.price, v_product.cost_price, v_line);

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

revoke all on function public.generate_simulation_data(integer, integer, integer) from public, anon;
grant execute on function public.generate_simulation_data(integer, integer, integer) to authenticated;
