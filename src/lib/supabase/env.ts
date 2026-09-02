/**
 * Membaca konfigurasi Supabase dari environment.
 *
 * Next.js meng-inline variabel NEXT_PUBLIC_* saat build, jadi kalau lupa
 * diset di Vercel nilainya menjadi undefined dan aplikasi gagal dengan pesan
 * yang membingungkan. Guard ini membuat penyebabnya langsung terbaca.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase belum lengkap. Set NEXT_PUBLIC_SUPABASE_URL dan " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY di environment (Vercel: Project Settings → " +
        "Environment Variables), lalu deploy ulang.",
    );
  }

  return { url, key };
}
