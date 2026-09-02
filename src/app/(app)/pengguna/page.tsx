"use client";

import * as React from "react";
import { KeyRound, Lock, Plus, UserCog, Users } from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  createCashier,
  deleteCashier,
  listProfiles,
  resetCashierPassword,
  resetCashierPin,
  setMyPin,
  setProfileActive,
  updateProfile,
} from "@/lib/services/admin";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Select,
  useToast,
} from "@/components/ui";
import { AdminOnly, PageHeader } from "@/components/app-shell";
import type { Profile, UserRole } from "@/lib/types";
import { tanggal } from "@/lib/format";

export default function PenggunaPage() {
  return (
    <AdminOnly>
      <PenggunaInner />
    </AdminOnly>
  );
}

function PenggunaInner() {
  const { profile: me, refresh } = useApp();
  const toast = useToast();

  const [rows, setRows] = React.useState<Profile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pinFor, setPinFor] = React.useState<Profile | null>(null);
  const [passwordFor, setPasswordFor] = React.useState<Profile | null>(null);

  // `tick` dinaikkan dari event handler untuk memaksa muat ulang, sehingga
  // seluruh pembaruan state terjadi di dalam efek setelah await.
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await listProfiles();
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Gagal memuat pengguna", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick, toast]);

  if (loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Kelola akun admin dan kasir toko kamu."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Tambah kasir
          </Button>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Belum ada pengguna" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Nama</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Kode kasir</th>
                  <th className="px-4 py-2.5 font-medium">Peran</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Bergabung</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {p.name}
                      {p.id === me?.id && <span className="ml-2 text-xs text-slate-400">(kamu)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.code ? (
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">
                          {p.code}
                        </code>
                      ) : (
                        <span className="text-xs text-slate-400">belum diatur</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={p.role}
                        disabled={p.id === me?.id}
                        onChange={async (e) => {
                          await updateProfile(p.id, { role: e.target.value as UserRole });
                          toast("Peran diperbarui", "success");
                          reload();
                        }}
                        className="h-8 w-auto py-1 text-xs"
                        aria-label={`Peran ${p.name}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="kasir">Kasir</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={p.id === me?.id}
                        onClick={async () => {
                          await setProfileActive(p.id, !p.is_active);
                          toast(p.is_active ? "Akun dinonaktifkan" : "Akun diaktifkan", "success");
                          reload();
                        }}
                        className="disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Badge tone={p.is_active ? "green" : "slate"}>
                          {p.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{tanggal(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPinFor(p)}
                          aria-label={`Atur PIN ${p.name}`}
                          title="Atur kode & PIN"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <KeyRound className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPasswordFor(p)}
                          aria-label={`Ganti kata sandi ${p.name}`}
                          title="Ganti kata sandi"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Lock className="size-4" />
                        </button>
                        {p.id !== me?.id && (
                          <button
                            type="button"
                            aria-label={`Hapus ${p.name}`}
                            title="Hapus akun"
                            onClick={async () => {
                              if (
                                !confirm(
                                  `Hapus akun "${p.name}" permanen? Riwayat transaksinya ikut terhapus.`,
                                )
                              )
                                return;
                              try {
                                await deleteCashier(p.id);
                                toast("Akun dihapus", "success");
                                reload();
                              } catch (err) {
                                toast(
                                  err instanceof Error ? err.message : "Gagal menghapus akun",
                                  "error",
                                );
                              }
                            }}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <UserCog className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {createOpen && (
        <CreateCashierModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      )}

      {pinFor && (
        <PinModal
          key={pinFor.id}
          target={pinFor}
          isSelf={pinFor.id === me?.id}
          onClose={() => setPinFor(null)}
          onSaved={() => {
            setPinFor(null);
            void refresh();
            reload();
          }}
        />
      )}

      {passwordFor && (
        <PasswordModal
          key={passwordFor.id}
          target={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={() => setPasswordFor(null)}
        />
      )}
    </>
  );
}

function CreateCashierModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
    code: "",
    pin: "",
    role: "kasir" as UserRole,
  });
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast("Kata sandi minimal 8 karakter", "error");
      return;
    }
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) {
      toast("PIN harus 4-6 digit angka", "error");
      return;
    }

    setSaving(true);
    try {
      await createCashier({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        code: form.code || undefined,
        pin: form.pin || undefined,
      });
      toast("Akun kasir dibuat", "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal membuat akun", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Tambah kasir"
      description="Kasir bisa masuk pakai email + kata sandi, atau lebih cepat pakai kode + PIN di device toko."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={(e) => void submit(e)} loading={saving}>
            Buat akun
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama" required>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Siti Rahayu"
            required
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="siti@warung.com"
              required
            />
          </Field>

          <Field label="Kata sandi" hint="Minimal 8 karakter" required>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kode kasir" hint="Untuk login PIN">
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="K01"
            />
          </Field>

          <Field label="PIN" hint="4-6 digit">
            <Input
              inputMode="numeric"
              value={form.pin}
              onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="1234"
            />
          </Field>

          <Field label="Peran">
            <Select value={form.role} onChange={(e) => set("role", e.target.value as UserRole)}>
              <option value="kasir">Kasir</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function PinModal({
  target,
  isSelf,
  onClose,
  onSaved,
}: {
  target: Profile;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = React.useState(() => target.code ?? "");
  const [pin, setPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="Kode & PIN kasir"
      description={`${target.name} — dipakai untuk login cepat di device toko`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!code.trim() || !/^\d{4,6}$/.test(pin)}
            onClick={async () => {
              setSaving(true);
              try {
                if (isSelf) await setMyPin(code, pin);
                else await resetCashierPin(target.id, code, pin);
                toast("Kode & PIN diperbarui", "success");
                onSaved();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Gagal menyimpan PIN", "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Kode kasir" hint="Unik per pengguna, contoh K01" required>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="K01"
            autoFocus
          />
        </Field>

        <Field label="PIN baru" hint="4-6 digit angka" required>
          <Input
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="1234"
            className="text-lg tracking-widest"
          />
        </Field>
      </div>
    </Modal>
  );
}

function PasswordModal({
  target,
  onClose,
  onSaved,
}: {
  target: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="Ganti kata sandi"
      description={target.name}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={password.length < 8}
            onClick={async () => {
              setSaving(true);
              try {
                await resetCashierPassword(target.id, password);
                toast("Kata sandi diperbarui", "success");
                onSaved();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Gagal mengganti kata sandi", "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Kata sandi baru" hint="Minimal 8 karakter" required>
        <Input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  );
}
