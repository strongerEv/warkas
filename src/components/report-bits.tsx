"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, Input, Select, cx } from "@/components/ui";
import { PERIOD_LABEL, deltaPersen, type PeriodPreset } from "@/lib/format";

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  compare,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
  compare?: { now: number; prev: number } | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    slate: "text-slate-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
    blue: "text-sky-700",
  } as const;

  const iconTones = {
    slate: "bg-slate-100 text-slate-500",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-sky-50 text-sky-600",
  } as const;

  const delta = compare ? deltaPersen(compare.now, compare.prev) : null;
  const naik = (delta ?? 0) >= 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cx("mt-1.5 truncate text-2xl font-bold tabular-nums", tones[tone])}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          {delta !== null && (
            <p
              className={cx(
                "mt-1.5 inline-flex items-center gap-1 text-xs font-medium",
                naik ? "text-emerald-600" : "text-red-600",
              )}
            >
              {naik ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {naik ? "+" : ""}
              {delta.toFixed(1)}% vs periode sebelumnya
            </p>
          )}
        </div>
        {Icon && (
          <div className={cx("rounded-xl p-2", iconTones[tone])}>
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

export interface PeriodState {
  preset: PeriodPreset;
  from: string;
  to: string;
}

export function PeriodFilter({
  value,
  onChange,
  extra,
}: {
  value: PeriodState;
  onChange: (next: PeriodState) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as PeriodPreset })}
        className="w-auto min-w-40"
        aria-label="Rentang waktu"
      >
        {(Object.keys(PERIOD_LABEL) as PeriodPreset[]).map((p) => (
          <option key={p} value={p}>
            {PERIOD_LABEL[p]}
          </option>
        ))}
      </Select>

      {value.preset === "custom" && (
        <>
          <Input
            type="date"
            value={value.from}
            max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-auto"
            aria-label="Dari tanggal"
          />
          <span className="text-sm text-slate-400">s/d</span>
          <Input
            type="date"
            value={value.to}
            min={value.from}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-auto"
            aria-label="Sampai tanggal"
          />
        </>
      )}

      {extra}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-3 pb-4 pt-1">{children}</div>
    </Card>
  );
}
