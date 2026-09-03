"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PAYMENT_METHOD_LABEL, type DashboardReport, type Expense, type ShiftReport } from "@/lib/types";
import { num, rupiah, tanggal, tanggalJam } from "@/lib/format";

const MARGIN = 14;

function header(doc: jsPDF, storeName: string, title: string, subtitle?: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(storeName, MARGIN, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(70);
  doc.text(title, MARGIN, 27);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(subtitle, MARGIN, 33);
  }

  doc.setDrawColor(220);
  doc.line(MARGIN, 37, doc.internal.pageSize.getWidth() - MARGIN, 37);
  doc.setTextColor(0);
  return 45;
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Dibuat dengan Warkas • ${tanggalJam(new Date())}`, MARGIN, height - 10);
    doc.text(`Halaman ${i} dari ${pages}`, width - MARGIN, height - 10, { align: "right" });
  }
}

const TABLE_STYLE = {
  theme: "striped" as const,
  headStyles: { fillColor: [5, 150, 105] as [number, number, number], fontSize: 9 },
  styles: { fontSize: 9, cellPadding: 3 },
  margin: { left: MARGIN, right: MARGIN },
};

function afterTable(doc: jsPDF, fallback: number) {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return (last?.finalY ?? fallback) + 10;
}

/* ---------------- Laporan shift ---------------- */

export function exportShiftPdf(report: ShiftReport, storeName: string, prefix = "Rp") {
  const doc = new jsPDF();
  const s = report.shift;

  let y = header(
    doc,
    storeName,
    `Laporan Shift — ${report.kasir}`,
    `${tanggalJam(s.opened_at)} s/d ${s.closed_at ? tanggalJam(s.closed_at) : "sedang berjalan"}${
      s.is_simulation ? "  •  DATA SIMULASI" : ""
    }`,
  );

  autoTable(doc, {
    ...TABLE_STYLE,
    startY: y,
    head: [["Ringkasan kas", "Nilai"]],
    body: [
      ["Modal awal", rupiah(s.opening_cash, prefix)],
      ["Penjualan tunai", rupiah(report.penjualan_tunai, prefix)],
      ["Pengeluaran tunai", `-${rupiah(report.pengeluaran_tunai, prefix)}`],
      ["Kas seharusnya", rupiah(report.kas_seharusnya, prefix)],
      ["Kas fisik", s.closing_cash === null ? "-" : rupiah(s.closing_cash, prefix)],
      [
        "Selisih",
        s.difference === null
          ? "-"
          : `${num(s.difference) > 0 ? "+" : ""}${rupiah(s.difference, prefix)}`,
      ],
    ],
    columnStyles: { 1: { halign: "right" } },
  });

  y = afterTable(doc, y);

  autoTable(doc, {
    ...TABLE_STYLE,
    startY: y,
    head: [["Penjualan", "Nilai"]],
    body: [
      ["Total omzet", rupiah(report.omzet, prefix)],
      ["Modal barang (HPP)", `-${rupiah(report.hpp, prefix)}`],
      ["Laba kotor", rupiah(report.laba_kotor, prefix)],
      ["Jumlah transaksi", `${num(report.jumlah_transaksi)} struk`],
      ["Total pengeluaran", rupiah(report.pengeluaran_total, prefix)],
      ...report.metode_bayar.map((m) => [
        `  ${PAYMENT_METHOD_LABEL[m.metode] ?? m.metode} (${m.jumlah}x)`,
        rupiah(m.total, prefix),
      ]),
    ],
    columnStyles: { 1: { halign: "right" } },
  });

  y = afterTable(doc, y);

  if (report.produk.length) {
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y,
      head: [["Produk terjual", "Qty", "Omzet", "Laba"]],
      body: report.produk.map((p) => [
        p.nama,
        String(p.qty),
        rupiah(p.omzet, prefix),
        rupiah(p.laba, prefix),
      ]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
  }

  if (s.note) {
    const ny = afterTable(doc, y);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Catatan: ${s.note}`, MARGIN, ny);
  }

  footer(doc);
  doc.save(`shift-${report.kasir.replace(/\s+/g, "-").toLowerCase()}-${tanggal(s.opened_at)}.pdf`);
}

/* ---------------- Laporan periode ---------------- */

export function exportReportPdf(
  report: DashboardReport,
  opts: { storeName: string; address?: string | null; from: Date; to: Date; sim: boolean; prefix?: string },
) {
  const prefix = opts.prefix ?? "Rp";
  const doc = new jsPDF();
  const akhir = new Date(opts.to.getTime() - 1);

  let y = header(
    doc,
    opts.storeName,
    "Laporan Keuangan",
    `${tanggal(opts.from)} s/d ${tanggal(akhir)}${opts.sim ? "  •  DATA SIMULASI" : ""}${
      opts.address ? `  •  ${opts.address}` : ""
    }`,
  );

  autoTable(doc, {
    ...TABLE_STYLE,
    startY: y,
    head: [["Laba rugi", "Nilai"]],
    body: [
      ["Omzet", rupiah(report.omzet, prefix)],
      ["Modal barang terjual (HPP)", `-${rupiah(report.hpp, prefix)}`],
      ["LABA KOTOR", `${rupiah(report.laba_kotor, prefix)}  (${num(report.margin_kotor).toFixed(1)}%)`],
      ["Pengeluaran operasional", `-${rupiah(report.pengeluaran, prefix)}`],
      ["LABA BERSIH", `${rupiah(report.laba_bersih, prefix)}  (${num(report.margin_bersih).toFixed(1)}%)`],
      ["", ""],
      ["Total diskon", rupiah(report.total_diskon, prefix)],
      ["Jumlah transaksi", `${num(report.jumlah_transaksi)} struk`],
      ["Rata-rata per transaksi", rupiah(report.rata_transaksi, prefix)],
    ],
    columnStyles: { 1: { halign: "right" } },
  });

  y = afterTable(doc, y);

  if (report.metode_bayar.length) {
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y,
      head: [["Metode pembayaran", "Transaksi", "Total"]],
      body: report.metode_bayar.map((m) => [
        PAYMENT_METHOD_LABEL[m.metode] ?? m.metode,
        String(m.jumlah),
        rupiah(m.total, prefix),
      ]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = afterTable(doc, y);
  }

  if (report.kategori_pengeluaran.length) {
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y,
      head: [["Pengeluaran per kategori", "Total"]],
      body: report.kategori_pengeluaran.map((c) => [c.kategori, rupiah(c.total, prefix)]),
      columnStyles: { 1: { halign: "right" } },
    });
    y = afterTable(doc, y);
  }

  if (report.produk_terlaris.length) {
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y,
      head: [["Produk", "Qty", "Omzet", "Modal", "Laba"]],
      body: [...report.produk_terlaris]
        .sort((a, b) => num(b.laba) - num(a.laba))
        .map((p) => [
          p.nama,
          String(p.qty),
          rupiah(p.omzet, prefix),
          rupiah(num(p.hpp), prefix),
          rupiah(p.laba, prefix),
        ]),
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });
    y = afterTable(doc, y);
  }

  if (report.tren.length) {
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y,
      head: [["Tanggal", "Trx", "Omzet", "HPP", "Pengeluaran", "Laba bersih"]],
      body: report.tren.map((t) => [
        tanggal(`${t.tanggal}T00:00:00`),
        String(t.transaksi),
        rupiah(t.omzet, prefix),
        rupiah(t.hpp, prefix),
        rupiah(t.pengeluaran, prefix),
        rupiah(num(t.omzet) - num(t.hpp) - num(t.pengeluaran), prefix),
      ]),
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  }

  footer(doc);
  doc.save(`laporan-warkas-${tanggal(opts.from)}-${tanggal(akhir)}.pdf`.replace(/\s/g, ""));
}

/* ---------------- Cadangan sebelum reset ---------------- */

export function exportBackupCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  // BOM supaya Excel membaca karakter Indonesia dengan benar.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportExpensesPdf(
  expenses: Expense[],
  opts: { storeName: string; from: string; to: string; prefix?: string },
) {
  const prefix = opts.prefix ?? "Rp";
  const doc = new jsPDF();
  const y = header(
    doc,
    opts.storeName,
    "Laporan Pengeluaran",
    `${tanggal(opts.from)} s/d ${tanggal(opts.to)}`,
  );

  autoTable(doc, {
    ...TABLE_STYLE,
    startY: y,
    head: [["Tanggal", "Kategori", "Catatan", "Oleh", "Nominal"]],
    body: expenses.map((e) => [
      tanggal(e.expense_date),
      e.category?.name ?? "-",
      e.note ?? "-",
      e.user?.name ?? "-",
      rupiah(e.amount, prefix),
    ]),
    foot: [
      [
        "",
        "",
        "",
        "Total",
        rupiah(
          expenses.reduce((sum, e) => sum + num(e.amount), 0),
          prefix,
        ),
      ],
    ],
    columnStyles: { 4: { halign: "right" } },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
  });

  footer(doc);
  doc.save(`pengeluaran-${opts.from}-${opts.to}.pdf`);
}
