/**
 * Stub API Supabase untuk keperluan tangkapan layar.
 *
 * Sandbox tempat repo ini dibangun memblokir *.supabase.co, sehingga aplikasi
 * tidak bisa menghubungi database aslinya. Stub ini menyajikan bentuk respons
 * yang sama (PostgREST + GoTrue) di localhost, jadi aplikasi Next.js yang
 * dipotret adalah aplikasi yang sungguhan — komponen, tata letak, dan
 * perhitungan di layar semuanya kode asli. Yang disediakan di sini hanya
 * datanya, dan angkanya dibuat konsisten satu sama lain.
 *
 * Jalan sendiri:  node social/instagram/stub-api.mjs
 */
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 54999);
const NOW = new Date("2026-10-03T13:40:00+07:00");
const USER_ID = "8188b917-631d-41f2-8b21-ae8c834f5d0d";
const STORE_ID = "2f5c0a10-1111-4c2a-9f10-aa0b1c2d3e4f";
const SHIFT_ID = "7c1d2e30-2222-4b3a-8e21-bb1c2d3e4f50";

/* ---------- Angka acak yang sama setiap dijalankan ---------- */
function prng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/* ---------- Katalog ---------- */
const CATS = [
  { id: "c1", name: "Makanan", color: "#f97316", sort_order: 1 },
  { id: "c2", name: "Minuman", color: "#0ea5e9", sort_order: 2 },
  { id: "c3", name: "Snack", color: "#a855f7", sort_order: 3 },
];

const RAW_PRODUCTS = [
  ["Nasi Goreng Spesial", 18000, 11000, 24, "c1"],
  ["Mie Ayam Bakso", 15000, 9000, 18, "c1"],
  ["Ayam Geprek", 16000, 10000, 12, "c1"],
  ["Nasi Uduk", 8000, 4500, 30, "c1"],
  ["Es Teh Manis", 4000, 1500, 60, "c2"],
  ["Es Jeruk", 6000, 2500, 42, "c2"],
  ["Kopi Susu", 12000, 5000, 20, "c2"],
  ["Air Mineral", 3000, 2000, 48, "c2"],
  ["Kerupuk", 2000, 1000, 4, "c3"],
  ["Pisang Goreng", 7000, 3000, 16, "c3"],
  ["Tahu Crispy", 6000, 2500, 14, "c3"],
  ["Roti Bakar", 10000, 4500, 9, "c3"],
];

const PRODUCTS = RAW_PRODUCTS.map(([name, price, cost, stock, catId], i) => {
  const cat = CATS.find((c) => c.id === catId);
  return {
    id: `p${i + 1}`,
    store_id: STORE_ID,
    category_id: catId,
    name,
    price,
    cost_price: cost,
    stock,
    low_stock_threshold: 5,
    track_stock: true,
    image_url: null,
    sku: `W-${String(i + 1).padStart(3, "0")}`,
    is_active: true,
    is_simulation: false,
    created_at: "2026-09-04T02:00:00Z",
    updated_at: "2026-10-01T02:00:00Z",
    category: { id: cat.id, name: cat.name, color: cat.color },
  };
});

/* ---------- Laporan 30 hari, dibuat agar jumlahnya konsisten ---------- */
const TARGET = {
  omzet: 18420000,
  hpp: 9937000,
  pengeluaran: 4260000,
  transaksi: 612,
  diskon: 185000,
};

function buildTrend() {
  const rnd = prng(20261003);
  const days = 30;
  const raw = [];

  for (let i = 0; i < days; i += 1) {
    const d = new Date(NOW);
    d.setDate(d.getDate() - (days - 1 - i));
    const dow = d.getDay();
    // Akhir pekan lebih ramai, hari biasa lebih datar.
    const musim = dow === 0 || dow === 6 ? 1.34 : dow === 5 ? 1.12 : 0.92;
    raw.push({ d, bobot: musim * (0.82 + rnd() * 0.38) });
  }

  const totalBobot = raw.reduce((s, r) => s + r.bobot, 0);
  let sisaOmzet = TARGET.omzet;
  let sisaHpp = TARGET.hpp;
  let sisaTrx = TARGET.transaksi;
  let sisaExp = TARGET.pengeluaran;

  return raw.map((r, i) => {
    const akhir = i === raw.length - 1;
    const bagian = r.bobot / totalBobot;

    const omzet = akhir ? sisaOmzet : Math.round((TARGET.omzet * bagian) / 500) * 500;
    const hpp = akhir ? sisaHpp : Math.round((TARGET.hpp * bagian) / 500) * 500;
    const transaksi = akhir ? sisaTrx : Math.max(1, Math.round(TARGET.transaksi * bagian));
    // Pengeluaran tidak merata: ada hari belanja besar, ada hari kosong.
    const expBagian = i % 7 === 2 ? bagian * 2.6 : i % 3 === 0 ? bagian * 0.9 : bagian * 0.45;
    const pengeluaran = akhir
      ? sisaExp
      : Math.min(sisaExp, Math.round((TARGET.pengeluaran * expBagian) / 1000) * 1000);

    sisaOmzet -= omzet;
    sisaHpp -= hpp;
    sisaTrx -= transaksi;
    sisaExp -= pengeluaran;

    return {
      tanggal: r.d.toISOString().slice(0, 10),
      omzet,
      transaksi,
      hpp,
      pengeluaran,
    };
  });
}

const TREN = buildTrend();

/** Produk terjual: qty dipilih agar omzetnya mendekati total, lalu laba dihitung dari modal. */
const TERJUAL = [
  ["Es Teh Manis", 412],
  ["Nasi Goreng Spesial", 268],
  ["Ayam Geprek", 196],
  ["Mie Ayam Bakso", 174],
  ["Kopi Susu", 148],
  ["Es Jeruk", 136],
  ["Nasi Uduk", 124],
  ["Pisang Goreng", 118],
  ["Air Mineral", 96],
  ["Roti Bakar", 74],
].map(([nama, qty]) => {
  const p = PRODUCTS.find((x) => x.name === nama);
  return {
    nama,
    qty,
    omzet: qty * p.price,
    hpp: qty * p.cost_price,
    laba: qty * (p.price - p.cost_price),
  };
});

const PER_JAM = [
  0, 0, 0, 0, 0, 2, 7, 16, 21, 18, 26, 54, 68, 47, 24, 19, 28, 58, 72, 61, 38, 17, 8, 3,
].map((transaksi, jam) => ({ jam, transaksi, omzet: transaksi * 30100 }));

const laba_kotor = TARGET.omzet - TARGET.hpp;
const laba_bersih = laba_kotor - TARGET.pengeluaran;

const LAPORAN = {
  omzet: TARGET.omzet,
  hpp: TARGET.hpp,
  laba_kotor,
  jumlah_transaksi: TARGET.transaksi,
  total_diskon: TARGET.diskon,
  pengeluaran: TARGET.pengeluaran,
  laba_bersih,
  margin_kotor: Math.round((laba_kotor / TARGET.omzet) * 1000) / 10,
  margin_bersih: Math.round((laba_bersih / TARGET.omzet) * 1000) / 10,
  item_tanpa_hpp: 0,
  rata_transaksi: Math.round((TARGET.omzet / TARGET.transaksi) * 100) / 100,
  tren: TREN,
  produk_terlaris: [...TERJUAL].sort((a, b) => b.qty - a.qty),
  produk_terlaba: [...TERJUAL].sort((a, b) => b.laba - a.laba),
  per_jam: PER_JAM,
  metode_bayar: [
    { metode: "cash", total: 11405000, jumlah: 396 },
    { metode: "qris", total: 4798000, jumlah: 152 },
    { metode: "transfer", total: 1904000, jumlah: 52 },
    { metode: "other", total: 313000, jumlah: 12 },
  ],
  kategori_pengeluaran: [
    { kategori: "Bahan Baku", warna: "#f97316", total: 2600000 },
    { kategori: "Gaji", warna: "#0ea5e9", total: 900000 },
    { kategori: "Listrik & Air", warna: "#eab308", total: 420000 },
    { kategori: "Sewa", warna: "#a855f7", total: 250000 },
    { kategori: "Lain-lain", warna: "#64748b", total: 90000 },
  ],
};

/** Periode sebelumnya sedikit lebih rendah supaya panah pembandingnya bercerita. */
const SEBELUMNYA = {
  omzet: 16240000,
  hpp: 8930000,
  laba_kotor: 7310000,
  pengeluaran: 4015000,
  laba_bersih: 3295000,
  jumlah_transaksi: 548,
};

/* ---------- Shift ---------- */
const SHIFTS = [
  {
    id: SHIFT_ID,
    store_id: STORE_ID,
    user_id: USER_ID,
    opening_cash: 300000,
    closing_cash: null,
    expected_cash: null,
    difference: null,
    status: "open",
    note: null,
    opened_at: "2026-10-03T00:10:00Z",
    closed_at: null,
    is_simulation: false,
    user: { id: USER_ID, name: "Bu Sri" },
  },
  ...[
    ["2026-10-02", 300000, 918000, 920000, "Siti"],
    ["2026-10-01", 250000, 874500, 872500, "Bu Sri"],
    ["2026-09-30", 300000, 1046000, 1046000, "Siti"],
    ["2026-09-29", 250000, 792000, 789000, "Bu Sri"],
  ].map(([tgl, modal, seharusnya, fisik, kasir], i) => ({
    id: `s${i + 2}`,
    store_id: STORE_ID,
    user_id: USER_ID,
    opening_cash: modal,
    closing_cash: fisik,
    expected_cash: seharusnya,
    difference: fisik - seharusnya,
    status: "closed",
    note: null,
    opened_at: `${tgl}T00:10:00Z`,
    closed_at: `${tgl}T14:35:00Z`,
    is_simulation: false,
    user: { id: USER_ID, name: kasir },
  })),
];

const SHIFT_REPORT = {
  shift: SHIFTS[0],
  kasir: "Bu Sri",
  omzet: 642000,
  hpp: 346500,
  laba_kotor: 295500,
  jumlah_transaksi: 23,
  penjualan_tunai: 418000,
  pengeluaran_tunai: 85000,
  pengeluaran_total: 85000,
  kas_seharusnya: 633000,
  metode_bayar: [
    { metode: "cash", total: 418000, jumlah: 15 },
    { metode: "qris", total: 174000, jumlah: 6 },
    { metode: "transfer", total: 50000, jumlah: 2 },
  ],
  produk: [
    { nama: "Es Teh Manis", qty: 18, omzet: 72000, laba: 45000 },
    { nama: "Nasi Goreng Spesial", qty: 11, omzet: 198000, laba: 77000 },
    { nama: "Ayam Geprek", qty: 8, omzet: 128000, laba: 48000 },
    { nama: "Kopi Susu", qty: 6, omzet: 72000, laba: 42000 },
  ],
};

/* ---------- Data tabel lain ---------- */
const PROFILE = {
  id: USER_ID,
  store_id: STORE_ID,
  name: "Bu Sri",
  role: "admin",
  code: "A01",
  email: "busri@warung.test",
  is_active: true,
  created_at: "2026-09-04T01:00:00Z",
};

const STORE = {
  id: STORE_ID,
  name: "Warung Bu Sri",
  address: "Jl. Melati No. 12, Bandung",
  phone: "081234567890",
  logo_url: null,
  simulation_mode: false,
  cashier_expense_limit: 100000,
  currency_prefix: "Rp",
  timezone: "Asia/Jakarta",
  receipt_footer: "Terima kasih telah berbelanja",
  created_at: "2026-09-04T01:00:00Z",
};

const EXPENSE_CATS = LAPORAN.kategori_pengeluaran.map((c, i) => ({
  id: `e${i + 1}`,
  store_id: STORE_ID,
  name: c.kategori,
  color: c.warna,
  is_simulation: false,
  created_at: "2026-09-04T01:00:00Z",
}));

const EXPENSES = [
  ["2026-10-03", "Bahan Baku", 85000, "Beras 5 kg + telur", "cash", "approved"],
  ["2026-10-02", "Bahan Baku", 142000, "Ayam 6 kg", "cash", "approved"],
  ["2026-10-02", "Listrik & Air", 180000, "Token listrik", "non_cash", "approved"],
  ["2026-10-01", "Gaji", 450000, "Gaji mingguan Siti", "non_cash", "approved"],
  ["2026-10-01", "Bahan Baku", 96000, "Minyak + bumbu", "cash", "approved"],
  ["2026-09-30", "Bahan Baku", 128000, "Sayur + tahu", "cash", "approved"],
  ["2026-09-29", "Lain-lain", 35000, "Gas 3 kg", "cash", "pending"],
].map(([tgl, kat, amount, note, source, status], i) => {
  const cat = EXPENSE_CATS.find((c) => c.name === kat);
  return {
    id: `x${i + 1}`,
    store_id: STORE_ID,
    shift_id: SHIFT_ID,
    user_id: USER_ID,
    category_id: cat.id,
    amount,
    note,
    receipt_url: null,
    expense_date: tgl,
    payment_source: source,
    status,
    approved_by: status === "approved" ? USER_ID : null,
    approved_at: status === "approved" ? `${tgl}T03:00:00Z` : null,
    created_at: `${tgl}T03:00:00Z`,
    is_simulation: false,
    category: { id: cat.id, name: cat.name, color: cat.color },
    user: { id: USER_ID, name: i % 2 ? "Siti" : "Bu Sri" },
  };
});

const TABLES = {
  profiles: [PROFILE],
  stores: [STORE],
  categories: CATS.map((c) => ({
    ...c,
    store_id: STORE_ID,
    is_simulation: false,
    created_at: "2026-09-04T01:00:00Z",
  })),
  products: PRODUCTS,
  shifts: SHIFTS,
  transactions: [],
  transaction_items: [],
  expense_categories: EXPENSE_CATS,
  expenses: EXPENSES,
  recurring_expenses: [],
  stock_logs: [],
  activity_logs: [],
};

const RPC = {
  report_dashboard: LAPORAN,
  report_compare: { sekarang: { ...LAPORAN }, sebelumnya: SEBELUMNYA },
  shift_report: SHIFT_REPORT,
  shift_expected_cash: SHIFT_REPORT.kas_seharusnya,
  low_stock_products: PRODUCTS.filter((p) => p.stock <= p.low_stock_threshold),
};

/* ---------- Sesi ---------- */
function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

const USER = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: PROFILE.email,
  email_confirmed_at: "2026-09-04T01:00:00Z",
  phone: "",
  confirmed_at: "2026-09-04T01:00:00Z",
  last_sign_in_at: NOW.toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { name: "Bu Sri" },
  identities: [],
  created_at: "2026-09-04T01:00:00Z",
  updated_at: NOW.toISOString(),
  is_anonymous: false,
};

function session() {
  // Dipatok ke waktu nyata, bukan NOW: kalau dihitung dari tanggal tetap,
  // klien menganggap token sudah kedaluwarsa dan menyegarkannya tanpa henti.
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const token = [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      sub: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: USER.email,
      iat: Math.floor(Date.now() / 1000),
      exp,
      session_id: "stub-session",
    }),
    Buffer.from("stub-signature").toString("base64url"),
  ].join(".");

  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: exp,
    refresh_token: "stub-refresh-token",
    user: USER,
  };
}

/* ---------- Server ---------- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range",
};

const META = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function samakan(nilai, mentah) {
  if (mentah === "null") return nilai === null;
  if (mentah === "true") return nilai === true;
  if (mentah === "false") return nilai === false;
  if (typeof nilai === "number") return Number(mentah) === nilai;
  return String(nilai) === mentah;
}

/** Menerapkan filter, urutan, dan batas seperti PostgREST, secukupnya. */
function terapkanKueri(rows, url) {
  let hasil = [...rows];

  for (const [kolom, ekspresi] of url.searchParams.entries()) {
    if (META.has(kolom)) continue;
    const pisah = ekspresi.indexOf(".");
    if (pisah < 0) continue;

    const op = ekspresi.slice(0, pisah);
    const nilai = ekspresi.slice(pisah + 1);

    hasil = hasil.filter((r) => {
      const v = r[kolom];
      switch (op) {
        case "eq":
          return samakan(v, nilai);
        case "neq":
          return !samakan(v, nilai);
        case "is":
          return nilai === "null" ? v === null : samakan(v, nilai);
        case "gt":
          return String(v) > nilai;
        case "gte":
          return String(v) >= nilai;
        case "lt":
          return String(v) < nilai;
        case "lte":
          return String(v) <= nilai;
        case "like":
        case "ilike":
          return new RegExp(`^${nilai.replace(/[%*]/g, ".*")}$`, "i").test(String(v));
        default:
          return true;
      }
    });
  }

  const order = url.searchParams.get("order");
  if (order) {
    const [kolom, arah] = order.split(".");
    const turun = arah === "desc";
    hasil.sort((a, b) => {
      const x = a[kolom];
      const y = b[kolom];
      if (x === y) return 0;
      return (x > y ? 1 : -1) * (turun ? -1 : 1);
    });
  }

  const limit = Number(url.searchParams.get("limit"));
  if (Number.isFinite(limit) && limit > 0) hasil = hasil.slice(0, limit);

  return hasil;
}

function send(res, status, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    ...CORS,
    "Content-Type": "application/json",
    "Content-Range": "0-0/*",
  });
  res.end(payload);
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // PostgREST mengembalikan objek tunggal, bukan array, saat .single()/.maybeSingle().
  const tunggal = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  if (process.env.STUB_DEBUG) {
    console.log(req.method, path, "| accept:", req.headers.accept, "| tunggal:", tunggal);
  }

  if (path === "/auth/v1/token") return send(res, 200, session());
  if (path === "/auth/v1/user") return send(res, 200, USER);
  if (path === "/auth/v1/logout") return send(res, 204);
  if (path.startsWith("/auth/v1/")) return send(res, 200, {});

  if (path.startsWith("/rest/v1/rpc/")) {
    const fn = path.replace("/rest/v1/rpc/", "");
    if (fn in RPC) return send(res, 200, RPC[fn]);
    return send(res, 200, null);
  }

  if (path.startsWith("/rest/v1/")) {
    const table = path.replace("/rest/v1/", "");
    const rows = terapkanKueri(TABLES[table] ?? [], url);
    return send(res, 200, tunggal ? (rows[0] ?? null) : rows);
  }

  send(res, 404, { message: "tidak dikenal", path });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`stub API Supabase siap di http://127.0.0.1:${PORT}`);
});
