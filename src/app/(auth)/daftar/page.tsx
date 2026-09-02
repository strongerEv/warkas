"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button, Card, Field, Input } from "@/components/ui";

export default function DaftarPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({ name: "", email: "", password: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (form.password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase().auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, role: "admin" } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Bila verifikasi email diaktifkan, sesi belum terbentuk sampai email diklik.
    if (!data.session) {
      setNotice("Akun dibuat. Cek email kamu untuk verifikasi, lalu masuk kembali.");
      setLoading(false);
      return;
    }

    router.replace("/setup");
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nama pemilik" required>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Budi Santoso"
            autoComplete="name"
            required
          />
        </Field>

        <Field label="Email" required>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="pemilik@warung.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Kata sandi" hint="Minimal 8 karakter" required>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}
        {notice && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {notice}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Buat akun pemilik
        </Button>
      </form>

      <p className="mt-5 border-t border-slate-200 pt-5 text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-medium text-brand-700 hover:underline">
          Masuk
        </Link>
      </p>
    </Card>
  );
}
