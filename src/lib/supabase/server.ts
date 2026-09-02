import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { readSupabaseConfig } from "@/lib/supabase/config";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  const config = readSupabaseConfig();

  if (!config) {
    throw new Error(
      "Konfigurasi Supabase belum tersedia. Set SUPABASE_URL dan SUPABASE_ANON_KEY di environment.",
    );
  }

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Dipanggil dari Server Component — refresh cookie ditangani proxy.
        }
      },
    },
  });
}
