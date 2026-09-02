"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button, Card, Field, Input, cx } from "@/components/ui";

const PIN_LENGTH = 6;

export default function PinLoginPage() {
  const router = useRouter();
  const codeRef = React.useRef<HTMLInputElement>(null);
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Kode kasir diingat per-device supaya kasir cukup mengetik PIN saja.
  // Nilainya ditulis langsung ke input (bukan lewat state) agar tidak memicu
  // render ulang dan tidak menimbulkan ketidakcocokan hidrasi.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("warkas.kode-kasir");
      if (saved && codeRef.current) codeRef.current.value = saved;
    } catch {
      // localStorage bisa diblokir (mode privat) — abaikan saja.
    }
  }, []);

  const submit = React.useCallback(
    async (pinValue: string) => {
      const code = codeRef.current?.value.trim() ?? "";
      if (!code) {
        setError("Isi kode kasir dulu.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase().functions.invoke<{
          token_hash: string;
          email: string;
        }>("pin-login", { body: { code, pin: pinValue } });

        if (fnError) throw new Error("Kode kasir atau PIN salah.");
        if (!data?.token_hash) throw new Error("Kode kasir atau PIN salah.");

        const { error: otpError } = await supabase().auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });
        if (otpError) throw new Error(otpError.message);

        try {
          localStorage.setItem("warkas.kode-kasir", code.toUpperCase());
        } catch {
          // abaikan
        }

        router.replace("/kasir");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal masuk.");
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  function press(digit: string) {
    if (loading) return;
    setError(null);
    const next = (pin + digit).slice(0, PIN_LENGTH);
    setPin(next);
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <Field label="Kode kasir">
          <Input
            ref={codeRef}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
              setError(null);
            }}
            placeholder="K01"
            autoCapitalize="characters"
            className="text-center text-lg font-semibold tracking-widest"
          />
        </Field>

        <div>
          <p className="mb-2 text-center text-sm font-medium text-slate-700">PIN</p>
          <div className="flex justify-center gap-2.5" aria-label={`PIN ${pin.length} digit`}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={cx(
                  "size-3.5 rounded-full transition-colors",
                  i < pin.length ? "bg-brand-600" : "bg-slate-200",
                )}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              className="h-14 rounded-xl bg-slate-100 text-xl font-semibold text-slate-800 transition-colors hover:bg-slate-200 active:bg-slate-300"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin("")}
            className="h-14 rounded-xl text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={() => press("0")}
            className="h-14 rounded-xl bg-slate-100 text-xl font-semibold text-slate-800 transition-colors hover:bg-slate-200 active:bg-slate-300"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((p) => p.slice(0, -1))}
            aria-label="Hapus satu digit"
            className="flex h-14 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
          >
            <Delete className="size-5" />
          </button>
        </div>

        <Button
          size="lg"
          className="w-full"
          loading={loading}
          disabled={pin.length < 4}
          onClick={() => void submit(pin)}
        >
          Masuk
        </Button>

        <p className="text-center text-sm text-slate-500">
          <Link href="/masuk" className="font-medium text-brand-700 hover:underline">
            Masuk dengan email &amp; kata sandi
          </Link>
        </p>
      </div>
    </Card>
  );
}
