import { Store } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl bg-brand-600 p-3 shadow-lg shadow-brand-600/20">
            <Store className="size-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warkas</h1>
          <p className="text-sm text-slate-500">Kasir &amp; pembukuan untuk warung dan UMKM</p>
        </div>
        {children}
      </div>
    </div>
  );
}
