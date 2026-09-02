import { AlertTriangle } from "lucide-react";

/**
 * Ditampilkan saat aplikasi ter-deploy tetapi kredensial Supabase belum diisi.
 * Lebih menolong daripada layar error, karena langsung menyebut variabel mana
 * yang kurang dan di mana mengisinya.
 */
export function ConfigNeeded({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">Warkas belum terhubung ke database</h1>
            <p className="text-sm text-slate-500">Tinggal satu langkah lagi.</p>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Environment variable berikut belum terisi:
        </p>

        <ul className="my-3 space-y-1">
          {missing.map((name) => (
            <li key={name}>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-semibold text-slate-800">
                {name}
              </code>
            </li>
          ))}
        </ul>

        <p className="text-sm text-slate-600">
          Isi di Vercel lewat <strong>Settings → Environment Variables</strong> (boleh bertipe
          Secret — nilainya dibaca saat request, bukan ditanam ke bundle), lalu deploy ulang.
          Nilainya ada di Supabase pada <strong>Project Settings → API</strong>.
        </p>
      </div>
    </div>
  );
}
