import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppProvider } from "@/lib/app-context";
import { ToastProvider } from "@/components/ui";
import { PwaRegister } from "@/components/pwa-register";
import { ConfigNeeded } from "@/components/config-needed";
import { missingSupabaseVars, readSupabaseConfig } from "@/lib/supabase/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Warkas — Kasir & Pembukuan UMKM",
  description:
    "Aplikasi kasir untuk warung dan UMKM: transaksi, stok, shift, pengeluaran, dan laporan laba bersih real-time.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Warkas" },
};

// Konfigurasi Supabase dibaca per request, bukan saat build, supaya nilainya
// tidak perlu ditanam ke bundle lewat prefix NEXT_PUBLIC_.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = readSupabaseConfig();

  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans antialiased">
        {config ? (
          <AppProvider config={config}>
            <ToastProvider>{children}</ToastProvider>
          </AppProvider>
        ) : (
          <ConfigNeeded missing={missingSupabaseVars()} />
        )}
        <PwaRegister />
      </body>
    </html>
  );
}
