"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { rupiah } from "@/lib/format";

/** Palet kategorikal yang tetap terbaca berdampingan. */
export const CHART_COLORS = [
  "#059669",
  "#0ea5e9",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#ec4899",
];

const AXIS = {
  stroke: "#94a3b8",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const ringkas = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(Math.round(n));
};

function TooltipBox({
  active,
  payload,
  label,
  asCurrency = true,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string | number;
  asCurrency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-semibold text-slate-900">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto font-medium text-slate-900">
            {asCurrency ? rupiah(p.value ?? 0) : (p.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({
  data,
}: {
  data: { tanggal: string; omzet: number; hpp: number; pengeluaran: number }[];
}) {
  // Biaya digabung (modal barang + operasional) supaya grafiknya bercerita
  // sederhana: uang masuk, uang keluar, dan sisanya.
  const rows = data.map((d) => {
    const omzet = Number(d.omzet);
    const biaya = Number(d.hpp) + Number(d.pengeluaran);
    return {
      label: new Date(`${d.tanggal}T00:00:00`).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      omzet,
      biaya,
      laba: omzet - biaya,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gLaba" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" {...AXIS} minTickGap={20} />
        <YAxis {...AXIS} tickFormatter={ringkas} width={48} />
        <Tooltip content={<TooltipBox />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area
          type="monotone"
          dataKey="omzet"
          name="Omzet"
          stroke="#0ea5e9"
          strokeWidth={2}
          fill="url(#gOmzet)"
        />
        <Area
          type="monotone"
          dataKey="biaya"
          name="Modal + pengeluaran"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="none"
          strokeDasharray="4 3"
        />
        <Area
          type="monotone"
          dataKey="laba"
          name="Laba bersih"
          stroke="#059669"
          strokeWidth={2.5}
          fill="url(#gLaba)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({
  data,
  mode = "qty",
}: {
  data: { nama: string; qty: number; laba?: number }[];
  mode?: "qty" | "laba";
}) {
  const byProfit = mode === "laba";
  const rows = data.slice(0, 8).map((d) => ({
    nama: d.nama,
    nilai: byProfit ? Number(d.laba ?? 0) : Number(d.qty),
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" {...AXIS} allowDecimals={false} tickFormatter={byProfit ? ringkas : undefined} />
        <YAxis type="category" dataKey="nama" {...AXIS} width={130} />
        <Tooltip content={<TooltipBox asCurrency={byProfit} />} cursor={{ fill: "#f1f5f9" }} />
        <Bar
          dataKey="nilai"
          name={byProfit ? "Laba" : "Terjual"}
          fill={byProfit ? "#059669" : "#0ea5e9"}
          radius={[0, 6, 6, 0]}
          barSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HourlyChart({ data }: { data: { jam: number; transaksi: number }[] }) {
  const rows = data.map((d) => ({
    ...d,
    transaksi: Number(d.transaksi),
    label: `${String(d.jam).padStart(2, "0")}`,
  }));
  const max = Math.max(...rows.map((r) => r.transaksi), 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={1} />
        <YAxis {...AXIS} allowDecimals={false} width={32} />
        <Tooltip content={<TooltipBox asCurrency={false} />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="transaksi" name="Transaksi" radius={[4, 4, 0, 0]}>
          {rows.map((r, i) => (
            // Jam paling ramai disorot supaya pola langsung terlihat.
            <Cell key={i} fill={r.transaksi >= max * 0.75 ? "#059669" : "#a7f3d0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
}: {
  data: { name: string; value: number; color?: string }[];
}) {
  const rows = data.map((d) => ({ ...d, value: Number(d.value) }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={88}
          paddingAngle={2}
          stroke="none"
        >
          {rows.map((r, i) => (
            <Cell key={i} fill={r.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<TooltipBox />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
