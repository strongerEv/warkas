"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { bootstrapStore } from "@/lib/services/admin";
import { Button, Card, Field, Input, LoadingBlock, Textarea, useToast } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const toast = useToast();
  const { profile, loading, refresh } = useApp();
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!loading && profile?.store_id) router.replace("/");
  }, [loading, profile, router]);

  if (loading) return <LoadingBlock />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await bootstrapStore(name, address);
      await refresh();
      toast("Toko berhasil dibuat. Selamat datang di Warkas!", "success");
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat toko.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 w-fit rounded-2xl bg-brand-600 p-3">
          <Store className="size-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Siapkan toko kamu</h1>
        <p className="mt-1 text-sm text-slate-500">
          Satu langkah terakhir. Kategori produk dan kategori pengeluaran standar akan otomatis
          dibuatkan.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nama toko" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Warung Bu Sri"
              required
            />
          </Field>

          <Field label="Alamat" hint="Opsional, muncul di struk dan laporan PDF">
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Jl. Melati No. 12, Bandung"
            />
          </Field>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={saving}>
            Buat toko
          </Button>
        </form>
      </Card>
    </div>
  );
}
