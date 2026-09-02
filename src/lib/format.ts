const RUPIAH = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const RUPIAH_DECIMAL = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function rupiah(value: number | string | null | undefined, prefix = "Rp") {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `${prefix}0`;
  const abs = RUPIAH.format(Math.abs(Math.round(n)));
  return `${n < 0 ? "-" : ""}${prefix}${abs}`;
}

export function angka(value: number | string | null | undefined) {
  return RUPIAH_DECIMAL.format(Number(value ?? 0));
}

export function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const TANGGAL = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const TANGGAL_JAM = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const JAM = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });

export function tanggal(value: string | Date | null | undefined) {
  if (!value) return "-";
  return TANGGAL.format(new Date(value));
}

export function tanggalJam(value: string | Date | null | undefined) {
  if (!value) return "-";
  return TANGGAL_JAM.format(new Date(value)).replace(/\./g, ":");
}

export function jam(value: string | Date | null | undefined) {
  if (!value) return "-";
  return JAM.format(new Date(value)).replace(/\./g, ":");
}

/** "2026-09-02" dalam zona waktu lokal browser, bukan UTC. */
export function isoDate(d: Date) {
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export type PeriodPreset = "hari-ini" | "kemarin" | "7-hari" | "30-hari" | "bulan-ini" | "bulan-lalu" | "custom";

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  "hari-ini": "Hari ini",
  kemarin: "Kemarin",
  "7-hari": "7 hari terakhir",
  "30-hari": "30 hari terakhir",
  "bulan-ini": "Bulan ini",
  "bulan-lalu": "Bulan lalu",
  custom: "Custom",
};

/**
 * Rentang tanggal untuk laporan. `to` selalu eksklusif (awal hari berikutnya)
 * agar transaksi di hari terakhir ikut terhitung penuh.
 */
export function periodRange(preset: PeriodPreset, from?: string, to?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const today = startOfDay(now);

  switch (preset) {
    case "hari-ini":
      return { from: today, to: addDays(today, 1) };
    case "kemarin":
      return { from: addDays(today, -1), to: today };
    case "7-hari":
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case "30-hari":
      return { from: addDays(today, -29), to: addDays(today, 1) };
    case "bulan-ini":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    case "bulan-lalu":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    case "custom": {
      const f = from ? new Date(`${from}T00:00:00`) : today;
      const t = to ? addDays(new Date(`${to}T00:00:00`), 1) : addDays(f, 1);
      return { from: f, to: t };
    }
  }
}

/** Selisih persen antara dua periode; null bila pembanding nol. */
export function deltaPersen(sekarang: number, sebelumnya: number): number | null {
  if (!sebelumnya) return sekarang ? null : 0;
  return ((sekarang - sebelumnya) / Math.abs(sebelumnya)) * 100;
}

export function inisial(nama: string) {
  return nama
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
