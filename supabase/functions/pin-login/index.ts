// Login cepat kasir memakai kode + PIN.
//
// Endpoint ini sengaja berjalan tanpa JWT (verify_jwt = false) karena inilah
// pintu masuk login itu sendiri. Yang dikembalikan bukan sesi, melainkan
// token_hash magic link sekali pakai yang harus ditukar client lewat
// `auth.verifyOtp`, sehingga service role key tidak pernah keluar dari server.
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

/** Jeda kecil agar waktu respons gagal/berhasil tidak bisa dijadikan oracle. */
const jeda = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 150));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);

  try {
    const { code, pin } = await req.json();

    if (typeof code !== "string" || typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
      await jeda();
      return json({ error: "Kode kasir atau PIN salah." }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await admin.rpc("verify_pin_login", {
      p_code: code,
      p_pin: pin,
    });

    const match = Array.isArray(data) ? data[0] : data;
    if (error || !match?.email) {
      await jeda();
      return json({ error: "Kode kasir atau PIN salah." }, 401);
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: match.email,
    });

    if (linkError || !link?.properties?.hashed_token) {
      return json({ error: "Gagal membuat sesi. Coba lagi." }, 500);
    }

    return json({ token_hash: link.properties.hashed_token, email: match.email });
  } catch {
    return json({ error: "Permintaan tidak valid." }, 400);
  }
});
