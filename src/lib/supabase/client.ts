"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase untuk browser.
 *
 * Tipe `Database` berasal dari codegen skema; regenerate setiap kali migrasi
 * berubah (perintahnya ada di header src/lib/database.types.ts).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

let browserClient: ReturnType<typeof createClient> | null = null;

/** Satu instance dipakai bersama supaya listener auth tidak dobel. */
export function supabase() {
  if (!browserClient) browserClient = createClient();
  return browserClient;
}
