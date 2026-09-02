"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button, Card, Field, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase().auth.signInWithPassword({ email, password });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Email atau kata sandi salah."
          : authError.message,
      );
      setLoading(false);
      return;
    }

    router.replace(params.get("next") || "/");
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pemilik@warung.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Kata sandi" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Masuk
        </Button>
      </form>

      <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
        <Link href="/pin">
          <Button variant="outline" size="lg" className="w-full">
            <KeyRound className="size-4" />
            Masuk cepat dengan PIN kasir
          </Button>
        </Link>
        <p className="text-center text-sm text-slate-500">
          Belum punya toko?{" "}
          <Link href="/daftar" className="font-medium text-brand-700 hover:underline">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </Card>
  );
}

export default function MasukPage() {
  return (
    <React.Suspense fallback={<Card className="h-80 animate-pulse" />}>
      <LoginForm />
    </React.Suspense>
  );
}
