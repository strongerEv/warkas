-- ============================================================
-- WARKAS — 0007: Kunci hak EXECUTE
--
-- Postgres memberi EXECUTE ke PUBLIC untuk setiap fungsi baru, dan role
-- `anon` mewarisi PUBLIC — artinya seluruh RPC tadi bisa dipanggil tanpa
-- login lewat /rest/v1/rpc/*. Isi fungsinya memang sudah menolak pemanggil
-- tanpa sesi, tetapi permukaan serangnya tidak perlu ada: cabut dulu dari
-- PUBLIC/anon, lalu berikan ulang hanya ke role yang memang membutuhkan.
-- ============================================================

do $$
declare
  fn record;
  -- Fungsi internal: hanya dipanggil dari trigger atau dari dalam fungsi
  -- SECURITY DEFINER lain, jadi tidak butuh grant ke role mana pun.
  internal text[] := array[
    'handle_new_user', 'log_activity', 'store_timezone', 'touch_updated_at',
    'admin_set_user_pin', 'verify_pin_login'
  ];
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon', fn.sig);

    if not (fn.proname = any (internal)) then
      execute format('grant execute on function %s to authenticated', fn.sig);
    else
      execute format('revoke all on function %s from authenticated', fn.sig);
    end if;
  end loop;
end $$;

-- Kembalikan hak service role untuk dua fungsi yang dipanggil Edge Function.
grant execute on function public.admin_set_user_pin(uuid, text, text) to service_role;
grant execute on function public.verify_pin_login(text, text)         to service_role;

-- Trigger function juga perlu search_path tetap agar tidak bisa dibajak
-- lewat objek bernama sama di schema lain.
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end $$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
