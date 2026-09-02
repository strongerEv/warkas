// Reset data toko (simulasi / total / pabrik).
//
// Penghapusan baris dijalankan oleh RPC `reset_data` memakai JWT pemanggil,
// sehingga pemeriksaan admin dan audit log terjadi di dalam database.
// Service role hanya dipakai untuk satu hal yang tidak bisa dilakukan RPC:
// menghapus akun auth pada reset pabrik.
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

const VALID = new Set(["simulation", "transactional", "factory"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Tidak terautentikasi" }, 401);

  let body: { type?: string; confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Permintaan tidak valid." }, 400);
  }

  const type = String(body.type ?? "");
  const confirmation = String(body.confirmation ?? "");

  if (!VALID.has(type)) return json({ error: "Jenis reset tidak dikenal." }, 400);
  if (!confirmation.trim()) return json({ error: "Konfirmasi wajib diisi." }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json({ error: "Sesi tidak valid" }, 401);

  const { data, error } = await caller.rpc("reset_data", {
    p_type: type,
    p_confirmation: confirmation,
  });

  if (error) return json({ error: error.message }, 400);

  // Reset pabrik: hapus akun auth kasir yang barisan profilnya sudah ditandai.
  const orphans: string[] = Array.isArray(data?.auth_user_ids) ? data.auth_user_ids : [];
  if (type === "factory" && orphans.length > 0) {
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    for (const id of orphans) {
      if (id !== user.id) await admin.auth.admin.deleteUser(id);
    }
  }

  return json(data);
});
