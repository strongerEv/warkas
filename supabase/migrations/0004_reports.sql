-- ============================================================
-- WARKAS — 0004: RPC laporan
--
-- Setiap fungsi laporan WAJIB menerima p_simulation dan selalu memfilter
-- is_simulation = p_simulation. Data sandbox karena itu tidak akan pernah
-- bocor ke laporan real, sekalipun UI salah kirim parameter.
-- Kasir otomatis dipaksa hanya melihat datanya sendiri.
-- ============================================================

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
    select ti.* from public.transaction_items ti join trx on trx.id = ti.transaction_id
  ),
  totals as (
    select coalesce((select sum(total) from trx), 0)   as omzet,
           coalesce((select count(*)  from trx), 0)    as jumlah_transaksi,
           coalesce((select sum(discount) from trx), 0) as total_diskon,
           coalesce((select sum(amount) from exp), 0)  as pengeluaran
  ),
  trend as (
    select d::date as tanggal,
           coalesce((select sum(t.total) from trx t
                      where (t.created_at at time zone v_tz)::date = d::date), 0) as omzet,
           coalesce((select count(*) from trx t
                      where (t.created_at at time zone v_tz)::date = d::date), 0) as transaksi,
           coalesce((select sum(e.amount) from exp e where e.expense_date = d::date), 0) as pengeluaran
      from generate_series(
             (p_from at time zone v_tz)::date,
             ((p_to at time zone v_tz) - interval '1 microsecond')::date,
             interval '1 day') d
  ),
  top_products as (
    select coalesce(i.product_name, 'Tanpa nama') as nama,
           sum(i.qty)::int as qty,
           sum(i.subtotal) as omzet
      from items i
     group by 1 order by qty desc, omzet desc limit 10
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
    'jumlah_transaksi', (select jumlah_transaksi from totals),
    'total_diskon',     (select total_diskon from totals),
    'pengeluaran',      (select pengeluaran from totals),
    'laba_bersih',      (select omzet - pengeluaran from totals),
    'rata_transaksi',   (select case when jumlah_transaksi > 0
                                     then round(omzet / jumlah_transaksi, 2) else 0 end from totals),
    'tren',             coalesce((select jsonb_agg(to_jsonb(t) order by t.tanggal) from trend t), '[]'::jsonb),
    'produk_terlaris',  coalesce((select jsonb_agg(to_jsonb(p)) from top_products p), '[]'::jsonb),
    'per_jam',          coalesce((select jsonb_agg(to_jsonb(h) order by h.jam) from hourly h), '[]'::jsonb),
    'metode_bayar',     coalesce((select jsonb_agg(to_jsonb(p)) from payments p), '[]'::jsonb),
    'kategori_pengeluaran', coalesce((select jsonb_agg(to_jsonb(c)) from expense_cats c), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

grant execute on function public.report_dashboard(timestamptz, timestamptz, boolean, uuid) to authenticated;

-- ---------- Perbandingan dengan periode sebelumnya (panjang sama) ----------
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
      'pengeluaran',      v_current -> 'pengeluaran',
      'laba_bersih',      v_current -> 'laba_bersih',
      'jumlah_transaksi', v_current -> 'jumlah_transaksi'),
    'sebelumnya', jsonb_build_object(
      'omzet',            v_previous -> 'omzet',
      'pengeluaran',      v_previous -> 'pengeluaran',
      'laba_bersih',      v_previous -> 'laba_bersih',
      'jumlah_transaksi', v_previous -> 'jumlah_transaksi')
  );
end $$;

grant execute on function public.report_compare(timestamptz, timestamptz, boolean, uuid) to authenticated;

-- ---------- Ringkasan satu shift (untuk struk tutup shift & PDF) ----------
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
        select ti.product_name as nama, sum(ti.qty)::int as qty, sum(ti.subtotal) as omzet
          from public.transaction_items ti
          join public.transactions t on t.id = ti.transaction_id
         where t.shift_id = v_shift.id
         group by 1 order by 2 desc) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

grant execute on function public.shift_report(uuid) to authenticated;

-- ---------- Produk yang stoknya menipis ----------
create or replace function public.low_stock_products(p_simulation boolean default false)
returns setof public.products
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.products
   where store_id = public.my_store_id()
     and is_simulation = coalesce(p_simulation, false)
     and is_active and track_stock
     and stock <= low_stock_threshold
   order by stock asc
$$;

grant execute on function public.low_stock_products(boolean) to authenticated;
