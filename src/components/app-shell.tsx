"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Badge, LoadingBlock, cx } from "@/components/ui";
import { inisial } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kasir", label: "Kasir", icon: ShoppingCart },
  { href: "/shift", label: "Shift", icon: ClipboardList },
  { href: "/transaksi", label: "Transaksi", icon: Receipt },
  { href: "/pengeluaran", label: "Pengeluaran", icon: Wallet },
  { href: "/produk", label: "Produk", icon: Boxes, adminOnly: true },
  { href: "/kategori", label: "Kategori", icon: Tags, adminOnly: true },
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/pengguna", label: "Pengguna", icon: Users, adminOnly: true },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, store, loading, isAdmin, sim, signOut } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Akun yang belum punya toko diarahkan ke wizard setup.
  React.useEffect(() => {
    if (!loading && profile && !profile.store_id && pathname !== "/setup") {
      router.replace("/setup");
    }
  }, [loading, profile, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }

  if (profile && !profile.store_id) {
    return <>{children}</>;
  }

  const items = NAV.filter((item) => !item.adminOnly || isAdmin);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid size-9 place-items-center rounded-xl bg-brand-600 font-bold text-white">
          W
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{store?.name ?? "Warkas"}</p>
          <p className="text-xs text-slate-500">Warkas POS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className={cx("size-[18px]", active ? "text-brand-600" : "text-slate-400")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {inisial(profile?.name ?? "?")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{profile?.name}</p>
            <p className="text-xs capitalize text-slate-500">{profile?.role}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Keluar"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {sim && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
          <FlaskConical className="size-4 shrink-0" />
          MODE SIMULASI AKTIF — semua data yang dibuat sekarang tidak masuk pembukuan asli
        </div>
      )}

      <div className="flex">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
          {sidebar}
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Tutup menu"
                className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Buka menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="size-5" />
            </button>
            <span className="font-semibold text-slate-900">{store?.name ?? "Warkas"}</span>
            {sim && (
              <Badge tone="amber" className="ml-auto">
                Simulasi
              </Badge>
            )}
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Pembungkus halaman khusus admin. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useApp();
  if (loading) return <LoadingBlock />;
  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
        <p className="font-medium text-amber-900">Halaman ini hanya untuk admin</p>
        <p className="mt-1 text-sm text-amber-800">
          Hubungi pemilik toko kalau kamu butuh akses ke menu ini.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
