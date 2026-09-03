// Manajemen akun kasir oleh admin toko.
//
// Service role key hanya dipakai di dalam Edge Function ini; halaman web
// tidak pernah menyentuhnya. Setiap permintaan diverifikasi dua kali:
// JWT valid, lalu profil pemanggil harus admin dan satu toko dengan target.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Tidak terautentikasi" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json({ error: "Sesi tidak valid" }, 401);

  const { data: me } = await admin
    .from("profiles")
    .select("id, role, store_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_active || me.role !== "admin" || !me.store_id) {
    return json({ error: "Hanya admin toko yang boleh mengelola pengguna." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Permintaan tidak valid." }, 400);
  }

  const action = String(body.action ?? "");

  /** Pastikan user target benar-benar anggota toko yang sama. */
  async function assertSameStore(userId: string) {
    const { data } = await admin
      .from("profiles")
      .select("id, store_id")
      .eq("id", userId)
      .maybeSingle();
    if (!data || data.store_id !== me!.store_id) {
      throw new Error("Pengguna tidak ditemukan di toko ini.");
    }
  }

  try {
    if (action === "create") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      const role = body.role === "admin" ? "admin" : "kasir";

      if (!name) return json({ error: "Nama wajib diisi." }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: "Format email tidak valid." }, 400);
      }
      if (password.length < 8) {
        return json({ error: "Kata sandi minimal 8 karakter." }, 400);
      }

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role, store_id: me.store_id },
      });

      if (error || !created.user) {
        return json({ error: error?.message ?? "Gagal membuat akun." }, 400);
      }

      // Trigger handle_new_user sudah membuat profil; pastikan toko & peran benar
      // untuk berjaga-jaga bila metadata tidak terbaca.
      await admin
        .from("profiles")
        .update({ store_id: me.store_id, role, name })
        .eq("id", created.user.id);

      if (body.code && body.pin) {
        const { error: pinError } = await admin.rpc("admin_set_user_pin", {
          p_user_id: created.user.id,
          p_code: String(body.code),
          p_pin: String(body.pin),
        });

        // Akun auth sudah terbuat pada langkah sebelumnya. Kalau pemasangan PIN
        // gagal, akun itu dibatalkan supaya admin bisa mencoba lagi dengan email
        // yang sama — tanpa ini, percobaan kedua ditolak "email sudah terdaftar"
        // sementara akun setengah jadi tertinggal di daftar pengguna.
        if (pinError) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json({ error: `Gagal memasang PIN: ${pinError.message}` }, 400);
        }
      }

      return json({ user_id: created.user.id });
    }

    if (action === "set_pin") {
      const userId = String(body.user_id ?? "");
      await assertSameStore(userId);

      const { error } = await admin.rpc("admin_set_user_pin", {
        p_user_id: userId,
        p_code: String(body.code ?? ""),
        p_pin: String(body.pin ?? ""),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "set_password") {
      const userId = String(body.user_id ?? "");
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "Kata sandi minimal 8 karakter." }, 400);

      await assertSameStore(userId);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const userId = String(body.user_id ?? "");
      if (userId === me.id) return json({ error: "Tidak bisa menghapus akun sendiri." }, 400);

      await assertSameStore(userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Terjadi kesalahan." }, 400);
  }
});
