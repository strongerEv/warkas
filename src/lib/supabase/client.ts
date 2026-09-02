"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Client Supabase untuk browser.
 *
 * Tipe `Database` berasal dari codegen skema; regenerate setiap kali migrasi
 * berubah (perintahnya ada di header src/lib/database.types.ts).
 */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key);
}

let browserClient: ReturnType<typeof createClient> | null = null;

/** Satu instance dipakai bersama supaya listener auth tidak dobel. */
export function supabase() {
  if (!browserClient) browserClient = createClient();
  return browserClient;
}
