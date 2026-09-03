-- ============================================================
-- WARKAS — 0009: Panggil pgcrypto dengan nama schema lengkap
--
-- Supabase sudah memasang pgcrypto di schema `extensions`, sehingga
-- `create extension if not exists pgcrypto` di 0001 hanya jadi no-op dan
-- crypt()/gen_salt() tidak pernah ada di `public`. Ketiga fungsi PIN dikunci
-- ke `search_path = public, pg_temp` demi keamanan, jadi keduanya tak
-- terlihat dan setiap operasi PIN gagal dengan
-- "function gen_salt(unknown) does not exist".
--
-- Diperbaiki dengan menyebut schema-nya eksplisit, bukan dengan melebarkan
-- search_path — supaya fungsi tetap kebal terhadap objek bernama sama di
-- schema lain.
-- ============================================================

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
         pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
   where id = auth.uid();
end $$;

create or replace function public.admin_set_user_pin(
  p_user_id uuid,
  p_code    text,
  p_pin     text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN harus 4-6 digit angka';
  end if;
  if coalesce(trim(p_code), '') = '' then
    raise exception 'Kode kasir wajib diisi';
  end if;

  update public.profiles
     set code = upper(trim(p_code)),
         pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
   where id = p_user_id;

  if not found then
    raise exception 'Pengguna tidak ditemukan';
  end if;
end $$;

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
     and p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
   limit 1;
end $$;

-- CREATE OR REPLACE mempertahankan hak akses yang ada, tetapi ditegaskan ulang
-- supaya migrasi ini aman dijalankan pada database yang masih bersih.
revoke all on function public.set_my_pin(text, text)               from public, anon;
grant execute on function public.set_my_pin(text, text)            to authenticated;

revoke all on function public.admin_set_user_pin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_user_pin(uuid, text, text) to service_role;

revoke all on function public.verify_pin_login(text, text)         from public, anon, authenticated;
grant execute on function public.verify_pin_login(text, text)      to service_role;
