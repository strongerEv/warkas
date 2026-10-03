# Carousel Instagram — Warkas · @yubuilds

Lima slide 1080 × 1350 px (`slide-1.png` … `slide-5.png`), seluruhnya digambar
dengan HTML + CSS lalu dipotret Chromium. Tangkapan layar di dalamnya diambil
dari aplikasi Warkas yang benar-benar dijalankan, bukan mockup.

---

## Caption

> **PROJECT FILE — Warkas**
>
> "Omzet sehari bisa sejuta, tapi akhir bulan kok uangnya nggak ada."
>
> Keluhan ini muncul berulang dari pemilik warung. Penyebabnya hampir selalu
> sama: yang dicatat cuma uang masuk. Modal barang yang terjual dan biaya
> operasional tidak pernah ikut dikurangkan, jadi omzet terlanjur dikira laba.
>
> Warkas mencatat transaksi lewat kasir tap-to-add, memotong stok otomatis,
> menampung pengeluaran, dan menutup shift dengan menghitung selisih kas laci.
> Semuanya bermuara ke satu layar: omzet dikurangi modal jadi laba kotor,
> dikurangi pengeluaran jadi laba bersih.
>
> Satu keputusan yang saya jaga sejak awal: harga modal disalin ke baris
> transaksi pada detik penjualan, bukan dibaca dari data produk saat laporan
> dibuka. Kalau harga kulakan naik bulan depan, laporan bulan lalu tetap
> memakai modal yang berlaku saat itu. Tanpa ini, angka pembukuan lama akan
> berubah sendiri setiap kali harga diperbarui — dan laporan yang bisa berubah
> sendiri tidak bisa dipercaya.
>
> Dibangun dengan Next.js 16, React 19, TypeScript, dan Tailwind di depan;
> Supabase Postgres di belakang dengan akses dibatasi per peran lewat RLS.
> Logika penjualan ditaruh di database sebagai RPC, bukan dititipkan ke
> browser. Transaksi saat koneksi putus ditampung IndexedDB dan tersinkron
> sendiri begitu online.
>
> Punya proses yang masih manual? Ceritakan alurnya lewat DM — nanti kita
> bongkar bareng.
>
> #yubuilds #projectportfolio #nextjs #supabase #postgresql #typescript
> #tailwindcss #pwa #aplikasikasir #umkm #posapp #indiehacker

---

## Isi folder

| Berkas | Keterangan |
|---|---|
| `carousel.html` | Lima `<section class="slide">`, seluruh desain ada di sini |
| `render.mjs` | Merender tiap `.slide` jadi PNG 1080 × 1350 |
| `shoot-app.mjs` | Memotret aplikasi pada 390 × 844 @3x, dikecilkan ke WebP 900 px |
| `stub-api.mjs` | Stub API Supabase di localhost untuk memberi data contoh |
| `fonts/`, `fonts.css` | Plus Jakarta Sans lokal, agar render tidak bergantung jaringan |
| `src/*.webp` | Tangkapan layar aplikasi |
| `slide-*.png` | Hasil akhir |

---

## Render ulang

Slide saja (tangkapan layar yang ada dipakai lagi):

```bash
node social/instagram/render.mjs
```

Berikut tangkapan layarnya, dari aplikasi yang dijalankan:

```bash
# 1. stub API
node social/instagram/stub-api.mjs &

# 2. aplikasi, diarahkan ke stub itu
export SUPABASE_URL=http://127.0.0.1:54999
export SUPABASE_ANON_KEY=stub-anon-key
npm run build && npx next start -p 3310 &

# 3. potret, lalu render
node social/instagram/shoot-app.mjs
node social/instagram/render.mjs
```

### Kenapa pakai stub

Sandbox tempat repo ini dikerjakan memblokir `*.supabase.co`, jadi aplikasi
tidak bisa menghubungi database aslinya untuk diambil tangkapan layarnya.

Yang distub hanya **sumber datanya**. Aplikasi yang dipotret tetap build
produksi Next.js yang sebenarnya — komponen, tata letak, pemformatan rupiah,
dan grafiknya semua kode asli. Keranjang di slide 1 pun terisi dengan benar-benar
menekan tombol produknya, bukan menyuntik state.

Kalau punya akses ke database sungguhan, lewati `stub-api.mjs` dan arahkan
`SUPABASE_URL` ke project Supabase berisi data contoh.

Jam browser dipatok ke `2026-10-03T13:40+07:00` lewat `page.clock.setFixedTime`,
supaya rentang "30 hari terakhir" menghasilkan angka yang sama setiap kali
tangkapan layarnya diambil ulang.
