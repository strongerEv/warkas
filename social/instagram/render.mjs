/**
 * Merender carousel.html menjadi lima PNG 1080×1350.
 *
 * Disajikan lewat server lokal, bukan file://, supaya font dan gambar termuat
 * dengan aturan yang sama seperti di browser biasa.
 *
 * Jalankan:  node social/instagram/render.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const AKAR = new URL(".", import.meta.url).pathname;
const PORT = Number(process.env.RENDER_PORT ?? 54810);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const berkas = join(AKAR, rel === "/" ? "carousel.html" : rel);
  try {
    const isi = await readFile(berkas);
    res.writeHead(200, { "Content-Type": MIME[extname(berkas)] ?? "application/octet-stream" });
    res.end(isi);
  } catch {
    res.writeHead(404).end("tidak ditemukan");
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

/** Chromium sudah ada di image; nomor build-nya belum tentu sama dengan paket playwright. */
function cariChromium() {
  const akar = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(akar)) return undefined;
  for (const d of readdirSync(akar).filter((x) => x.startsWith("chromium-"))) {
    const bin = join(akar, d, "chrome-linux", "chrome");
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: cariChromium() });
const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1,
});

await page.goto(`http://127.0.0.1:${PORT}/carousel.html`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

for (let i = 1; i <= 5; i += 1) {
  const el = page.locator(`#slide-${i}`);
  const kotak = await el.boundingBox();
  await el.screenshot({ path: join(AKAR, `slide-${i}.png`) });
  console.log(`✓ slide-${i}.png  ${Math.round(kotak.width)}×${Math.round(kotak.height)}`);
}

await browser.close();
server.close();
