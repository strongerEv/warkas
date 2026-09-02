"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import type { SupabaseConfig } from "@/lib/supabase/config";

/**
 * Konfigurasi dikirim server lewat <AppProvider> saat render pertama, jadi
 * `supabase()` bisa dipanggil dari mana saja tanpa perlu React context.
 */
let runtimeConfig: SupabaseConfig | null = null;

export function setSupabaseConfig(config: SupabaseConfig) {
  runtimeConfig = config;
}

function resolveConfig(): SupabaseConfig {
  // Nama berprefix dibaca sebagai cadangan untuk setup lama yang masih memakainya.
  const url = runtimeConfig?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = runtimeConfig?.key ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase belum tersedia. Set SUPABASE_URL dan SUPABASE_ANON_KEY " +
        "di environment, lalu deploy ulang.",
    );
  }

  return { url, key };
}

export function createClient() {
  const { url, key } = resolveConfig();
  return createBrowserClient<Database>(url, key);
}

let browserClient: ReturnType<typeof createClient> | null = null;

/** Satu instance dipakai bersama supaya listener auth tidak dobel. */
export function supabase() {
  if (!browserClient) browserClient = createClient();
  return browserClient;
}
