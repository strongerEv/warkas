/**
 * Memotret aplikasi Warkas yang benar-benar berjalan.
 *
 * Prasyarat: stub-api.mjs jalan di :54999 dan `next start` jalan di :3310
 * dengan SUPABASE_URL menunjuk ke stub itu (lihat README).
 *
 * Jam browser dipatok ke satu tanggal tetap supaya angka relatif ("30 hari
 * terakhir") menghasilkan tangkapan layar yang sama setiap diambil ulang.
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3310";
const OUT = new URL("./src/", import.meta.url).pathname;
const RAW = "/tmp/claude-0/-home-user-warkas/04ceccce-341a-57b0-8c73-5f4b5de9903e/scratchpad/raw-shots";
const WAKTU = new Date("2026-10-03T13:40:00+07:00");

/** Menggeser halaman agar elemen yang dimaksud utuh di tengah layar. */
async function pusatkan(page, teks) {
  await page.getByText(teks, { exact: false }).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const tengah = r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, tengah), behavior: "instant" });
  });
}

/** Potret layar aplikasi: 390x844 pada deviceScaleFactor 3. */
const LAYAR = [
  {
    nama: "kasir",
    jalan: "/kasir",
    siap: "text=Nasi Goreng Spesial",
    async aksi(page) {
      // Benar-benar menekan produknya, bukan menyuntik state keranjang.
      for (const nama of ["Nasi Goreng Spesial", "Es Teh Manis", "Es Teh Manis", "Ayam Geprek"]) {
        await page.getByRole("button", { name: new RegExp(nama) }).first().click();
        await page.waitForTimeout(120);
      }
    },
  },
  {
    nama: "dashboard",
    jalan: "/",
    siap: "text=Susunan laba",
    aksi: (page) => pusatkan(page, "Susunan laba"),
  },
  {
    nama: "laporan",
    jalan: "/laporan",
    siap: "text=Tren harian",
    aksi: (page) => pusatkan(page, "Tren harian"),
  },
  {
    nama: "shift",
    jalan: "/shift",
    siap: "text=Shift berjalan sejak",
    async aksi(page) {
      await page.evaluate(() => window.scrollBy(0, 150));
    },
  },
  {
    nama: "produk",
    jalan: "/produk",
    siap: "text=Nasi Goreng Spesial",
    async aksi(page) {
      // Dialog edit memperlihatkan kolom modal berikut pratinjau marginnya —
      // bagian yang paling menjelaskan fitur HPP.
      await page.getByRole("button", { name: "Ubah Nasi Goreng Spesial" }).click();
      await page.waitForSelector("text=Harga modal (HPP)");
      await page.waitForTimeout(400);
    },
  },
];

async function bersihkan(dir) {
  await mkdir(dir, { recursive: true });
  for (const f of await readdir(dir)) {
    if (f.endsWith(".png") || f.endsWith(".webp")) await unlink(join(dir, f));
  }
}

/**
 * Chromium sudah tersedia di image, tetapi nomor build-nya belum tentu sama
 * dengan yang diharapkan paket playwright. Binary-nya dicari langsung alih-alih
 * mengunduh ulang.
 */
function cariChromium() {
  const akar = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(akar)) return undefined;

  for (const dir of readdirSync(akar).filter((d) => d.startsWith("chromium-"))) {
    const bin = join(akar, dir, "chrome-linux", "chrome");
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

const executablePath = cariChromium();
console.log("chromium:", executablePath ?? "(bawaan playwright)");
const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  locale: "id-ID",
  timezoneId: "Asia/Jakarta",
});

await bersihkan(RAW);
await mkdir(OUT, { recursive: true });

const page = await context.newPage();
await page.clock.setFixedTime(WAKTU);

page.on("console", (m) => {
  if (m.type() === "error") console.log("  [browser]", m.text().slice(0, 160));
});

/* ---------- Masuk lewat formulir login yang sebenarnya ---------- */
await page.goto(`${APP}/masuk`, { waitUntil: "networkidle" });
await page.getByPlaceholder("pemilik@warung.com").fill("busri@warung.test");
await page.getByPlaceholder("••••••••").fill("rahasia-stub");
await page.getByRole("button", { name: "Masuk", exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/masuk"), { timeout: 30000 });
console.log("masuk sebagai admin:", page.url());

/* ---------- Potret tiap layar ---------- */
for (const layar of LAYAR) {
  await page.goto(`${APP}${layar.jalan}`, { waitUntil: "networkidle" });
  await page.waitForSelector(layar.siap, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);

  if (layar.aksi) await layar.aksi(page);
  await page.waitForTimeout(900);

  const mentah = join(RAW, `${layar.nama}.png`);
  await page.screenshot({ path: mentah });

  const tujuan = join(OUT, `${layar.nama}.webp`);
  await sharp(mentah).resize({ width: 900 }).webp({ quality: 92 }).toFile(tujuan);

  const { width, height } = await sharp(tujuan).metadata();
  console.log(`✓ ${layar.nama.padEnd(10)} ${width}×${height} webp`);
}

await browser.close();
console.log("selesai → social/instagram/src/");
