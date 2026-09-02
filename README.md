# Warkas — Kasir & Pembukuan UMKM

Aplikasi Point of Sale untuk warung, kios, dan UMKM F&B. Fokusnya satu hal:
pemilik tahu **laba bersih**, bukan cuma omzet kotor.

Transaksi, stok, shift kasir, dan pengeluaran dicatat di satu tempat, lalu
dirangkum jadi laporan yang bisa diekspor ke PDF.

---

## Jalankan secara lokal

```bash
npm install
cp .env.example .env.local   # isi dengan kredensial Supabase kamu
npm run dev
```

Buka http://localhost:3000, klik **Daftar**, buat akun pemilik, lalu isi nama
toko. Kategori produk dan kategori pengeluaran standar dibuat otomatis.

### Kredensial yang dibutuhkan

| Variabel | Ambil di |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API (publishable key) |

Service role key **tidak** dipakai aplikasi web — hanya hidup di dalam Edge
Function, jadi tidak perlu ditaruh di environment Next.js.

---

## Fitur

**Kasir (tap-to-add)** — grid produk berwarna per kategori, tap untuk tambah
qty, diskon per item maupun per transaksi, pembayaran tunai/QRIS/transfer,
hitung kembalian, cetak struk 58 mm atau kirim struk digital. Stok terpotong
otomatis saat transaksi selesai.

**Offline-first** — katalog di-cache ke IndexedDB. Kalau koneksi putus,
transaksi tersimpan di perangkat dan otomatis dikirim saat online kembali.
Setiap transaksi offline membawa `client_ref`, dan RPC `create_sale` bersifat
idempoten terhadapnya — sinkron dua kali tidak menghasilkan struk dobel.

**Shift** — kasir input modal awal saat buka. Saat tutup, sistem menghitung kas
seharusnya (`modal awal + penjualan tunai − pengeluaran tunai`), kasir mengisi
kas fisik, selisihnya langsung terlihat. Riwayat shift bisa diekspor ke PDF.

**Produk & stok** — CRUD produk, gambar, SKU, batas stok menipis, penyesuaian
stok manual yang terekam di riwayat, dan alert stok menipis di dashboard.
Produk jasa/olahan bisa dimatikan pelacakan stoknya.

**Pengeluaran** — kategori custom, foto struk (privat), pembedaan sumber dana
tunai vs non-tunai (hanya yang tunai memengaruhi kas laci), jadwal pengeluaran
rutin, dan approval admin untuk pengeluaran kasir di atas limit toko.

**Laporan** — omzet, pengeluaran, laba bersih, rata-rata per struk, tren harian,
produk terlaris, jam ramai, breakdown metode bayar dan kategori pengeluaran,
perbandingan dengan periode sebelumnya, filter per kasir, ekspor PDF.

**Mode simulasi** — sandbox untuk demo ke calon pengguna dan training kasir.
Lihat bagian di bawah.

**Reset data** — tiga tingkat, semuanya wajib konfirmasi ganda dan tercatat di
log aktivitas.

**PWA** — bisa dipasang di HP/tablet toko lewat menu "Add to Home Screen".

---

## Peran

| | Admin | Kasir |
|---|---|---|
| Produk, kategori, pengguna | ✅ | ❌ |
| Transaksi & buka/tutup shift | ✅ | ✅ (shift sendiri) |
| Input pengeluaran | ✅ | ✅ (di atas limit → approval) |
| Approve pengeluaran | ✅ | ❌ |
| Laporan | semua kasir | hanya miliknya |
| Simulasi & reset data | ✅ | ❌ |

Kasir bisa login pakai email + kata sandi, atau lebih cepat pakai **kode kasir +
PIN** di perangkat toko.

---

## Mode simulasi

Tujuannya: demo ke calon pembeli, training kasir baru, dan menguji laporan tanpa
mengotori pembukuan asli.

Saat sandbox aktif, banner kuning muncul di seluruh aplikasi dan:

- Shift, transaksi, dan pengeluaran baru ditandai `is_simulation = true`.
- Kasir **hanya bisa menjual produk simulasi**. Ini kunci pemisahannya — stok
  produk asli tidak mungkin terpotong saat demo, karena `create_sale` menolak
  produk yang flag simulasinya tidak sama dengan flag shift.
- Semua laporan memfilter `is_simulation` di sisi database, bukan di UI. Setiap
  RPC laporan wajib menerima parameter `p_simulation`, jadi data sandbox tidak
  bisa bocor ke laporan asli sekalipun UI salah kirim parameter.

Tombol **Generate Data Simulasi** membuat katalog contoh, shift, transaksi acak
30 hari terakhir dengan pola jam ramai realistis (puncak siang 11–13 dan sore
17–20, akhir pekan lebih ramai), plus pengeluaran di berbagai kategori.

---

## Reset data

| Jenis | Yang dihapus | Yang tetap |
|---|---|---|
| **Reset simulasi** | semua data ber-flag simulasi (termasuk produk & kategori sandbox) | seluruh data asli |
| **Reset total** | transaksi, pengeluaran, shift, riwayat stok — asli maupun simulasi | produk, kategori, pengguna |
| **Reset pabrik** | semuanya, termasuk produk, kategori, dan akun kasir | akun admin yang menjalankan |

Semua reset butuh konfirmasi ketik `HAPUS` atau nama toko, menawarkan unduh
cadangan CSV lebih dulu, dan tercatat di log aktivitas (siapa, kapan, apa).
Eksekusinya lewat Edge Function `reset-data`, bukan query langsung dari browser.

---

## Arsitektur

```
src/
  app/(auth)/          masuk, daftar, login PIN
  app/(app)/           dashboard, kasir, shift, transaksi, pengeluaran,
                       produk, kategori, laporan, pengguna, pengaturan
  components/          UI kit, app shell, grafik, struk
  lib/services/        SATU-SATUNYA lapisan akses data
  lib/offline.ts       cache Dexie + antrean transaksi offline
  lib/pdf.ts           ekspor PDF & CSV
supabase/
  migrations/          skema, RLS, RPC, laporan, simulasi, reset
  functions/           pin-login, admin-users, reset-data
```

### Prinsip yang dipegang

**Penulisan data transaksional tidak lewat tabel.** Tabel `shifts`,
`transactions`, `transaction_items`, `expenses`, dan `stock_logs` hanya punya
policy `SELECT`. Semua penulisan lewat RPC `SECURITY DEFINER`, sehingga flag
simulasi, harga jual, pemotongan stok, dan limit pengeluaran kasir ditentukan
server — bukan dikirim client.

**Harga diambil dari database.** `create_sale` mengabaikan harga yang dikirim
client dan memakai harga produk saat itu.

**RLS sejak awal.** Kasir hanya bisa membaca shift, transaksi, dan pengeluaran
miliknya sendiri; admin melihat seluruh toko. Fungsi laporan memaksa kasir ke
datanya sendiri, apa pun parameter yang dikirim.

**Service role key tidak pernah menyentuh browser.** Tiga hal yang butuh hak
admin — login PIN, manajemen akun kasir, dan reset data — dijalankan Edge
Function di Supabase.

---

## Perintah

```bash
npm run dev     # server pengembangan
npm run build   # build produksi (sekalian type-check)
npm run lint    # ESLint + aturan React Compiler
```

Setelah mengubah migrasi, regenerate tipe database:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

---

## Deploy ke Vercel

Repo ini tidak menyimpan binding ke project Vercel mana pun, jadi bisa
disambungkan ke project baru maupun yang sudah ada.

**1. Sambungkan repo.** Di project Vercel → Settings → Git → Connect Git
Repository → pilih `strongerEv/warkas`. Production branch diisi
`claude/warkas-pos-umkm-26m6wm` (itu default branch repo saat ini).

**2. Isi environment variable.** Settings → Environment Variables, centang
ketiga environment (Production, Preview, Development):

| Name | Value |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_ANON_KEY` | publishable key Supabase |

Keduanya boleh disimpan bertipe **Secret** — namanya sengaja tanpa prefix
`NEXT_PUBLIC_`, karena nilainya dibaca server saat request dan dikirim lewat
payload render, bukan ditanam ke dalam bundle saat build. Mengubah nilainya
cukup deploy ulang biasa; build cache tidak perlu dibuang.

Kalau variabel belum terisi, aplikasi tetap jalan dan menampilkan halaman yang
menyebutkan variabel mana yang kurang, bukan halaman error.

**3. Deploy**, lalu salin URL hasilnya.

**4. Daftarkan URL itu ke Supabase.** Authentication → URL Configuration:
setel *Site URL* ke domain produksi, dan tambahkan `https://<domain>/**` ke
*Redirect URLs*. Tanpa ini, tautan konfirmasi email masih mengarah ke
`localhost` dan pendaftaran akan buntu.

Setelah tersambung, setiap push ke production branch akan otomatis
men-deploy ulang.

---

## Catatan penyiapan

- **Konfirmasi email.** Project Supabase baru mengaktifkan konfirmasi email.
  Kalau ingin pendaftaran langsung bisa dipakai tanpa klik email, matikan di
  Authentication → Sign In / Providers → Email → *Confirm email*. Halaman daftar
  sudah menangani kedua kondisi tersebut.
- **Akun kasir** dibuat admin lewat menu Pengguna; akunnya langsung aktif tanpa
  perlu konfirmasi email.
- **Cetak struk thermal** memakai dialog cetak browser ke printer 58 mm
  (Bluetooth/USB), jadi izinkan popup di perangkat kasir.

---

## Roadmap berikutnya

Multi-cabang, notifikasi stok menipis via WhatsApp/email, dan integrasi
langsung ke thermal printer (tanpa dialog cetak browser).
