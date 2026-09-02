import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppProvider } from "@/lib/app-context";
import { ToastProvider } from "@/components/ui";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Warkas — Kasir & Pembukuan UMKM",
  description:
    "Aplikasi kasir untuk warung dan UMKM: transaksi, stok, shift, pengeluaran, dan laporan laba bersih real-time.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Warkas" },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans antialiased">
        <AppProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
