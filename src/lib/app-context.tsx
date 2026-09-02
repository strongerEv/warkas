"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { setSupabaseConfig, supabase } from "@/lib/supabase/client";
import type { SupabaseConfig } from "@/lib/supabase/config";
import type { Profile, Store } from "@/lib/types";

interface Session {
  user: User | null;
  profile: Profile | null;
  store: Store | null;
}

interface AppState extends Session {
  loading: boolean;
  isAdmin: boolean;
  /** Mode sandbox toko. Dipakai sebagai filter `is_simulation` di semua query. */
  sim: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const EMPTY: Session = { user: null, profile: null, store: null };

/**
 * Membaca user, profil, dan toko dalam satu kali jalan.
 *
 * Sengaja fungsi biasa (bukan hook) supaya bisa dipakai efek pemuatan awal
 * maupun `refresh()` dari event handler tanpa menduplikasi logika.
 */
async function loadSession(): Promise<Session> {
  const client = supabase();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return EMPTY;

  const { data: profile } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.store_id) return { user, profile: profile ?? null, store: null };

  const { data: store } = await client
    .from("stores")
    .select("*")
    .eq("id", profile.store_id)
    .maybeSingle();

  return { user, profile, store: store ?? null };
}

const AppContext = React.createContext<AppState | null>(null);

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp harus dipakai di dalam <AppProvider>");
  return ctx;
}

export function AppProvider({
  config,
  children,
}: {
  config: SupabaseConfig;
  children: React.ReactNode;
}) {
  // Dipasang sebelum anak-anaknya render, supaya `supabase()` sudah siap
  // dipakai dari mana pun tanpa perlu membaca React context.
  setSupabaseConfig(config);

  const router = useRouter();
  const [session, setSession] = React.useState<Session>(EMPTY);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const next = await loadSession();
      if (cancelled) return;
      setSession(next);
      setLoading(false);
    };

    void sync();

    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void sync();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const refresh = React.useCallback(async () => {
    setSession(await loadSession());
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase().auth.signOut();
    setSession(EMPTY);
    router.replace("/masuk");
  }, [router]);

  const value = React.useMemo<AppState>(
    () => ({
      ...session,
      loading,
      isAdmin: session.profile?.role === "admin",
      sim: session.store?.simulation_mode ?? false,
      refresh,
      signOut,
    }),
    [session, loading, refresh, signOut],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
