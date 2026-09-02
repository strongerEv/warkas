-- ============================================================
-- WARKAS — 0006: Fungsi khusus service role (dipanggil Edge Function)
-- ============================================================

-- Mengatur kode & PIN kasir milik orang lain. Hanya boleh dipanggil oleh
-- Edge Function `admin-users` yang sudah memverifikasi bahwa pemanggil admin.
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
         pin_hash = crypt(p_pin, gen_salt('bf'))
   where id = p_user_id;

  if not found then
    raise exception 'Pengguna tidak ditemukan';
  end if;
end $$;

revoke all on function public.admin_set_user_pin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_user_pin(uuid, text, text) to service_role;
grant execute on function public.verify_pin_login(text, text)        to service_role;
