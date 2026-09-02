export interface SupabaseConfig {
  url: string;
  key: string;
}

/**
 * Membaca konfigurasi Supabase di sisi server.
 *
 * Dibaca saat request, bukan saat build. Konsekuensinya nama variabel tidak
 * perlu berprefix `NEXT_PUBLIC_`: nilainya dikirim ke browser lewat payload
 * render, bukan ditanam ke dalam bundle JavaScript. Vercel karena itu tidak
 * lagi memperingatkan soal "public framework prefix", dan mengganti nilainya
 * cukup deploy ulang biasa tanpa perlu membuang build cache.
 *
 * Nama berprefix tetap diterima supaya konfigurasi lama tidak rusak.
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return { url, key };
}

/** Nama variabel yang belum terisi, untuk ditampilkan di layar setup. */
export function missingSupabaseVars(): string[] {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }
  if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("SUPABASE_ANON_KEY");
  }
  return missing;
}
