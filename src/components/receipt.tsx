"use client";

import * as React from "react";
import { Printer, Share2 } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { PAYMENT_METHOD_LABEL, type Store, type Transaction } from "@/lib/types";
import { rupiah, tanggalJam } from "@/lib/format";

/**
 * Struk 58mm. Dicetak lewat jendela terpisah supaya thermal printer
 * (Bluetooth/USB) bisa dipakai lewat dialog cetak bawaan browser.
 */
export function ReceiptModal({
  open,
  onClose,
  transaction,
  store,
  cashierName,
}: {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  store: Store | null;
  cashierName?: string;
}) {
  const toast = useToast();
  const ref = React.useRef<HTMLDivElement>(null);

  if (!transaction) return null;
  const prefix = store?.currency_prefix ?? "Rp";

  function print() {
    const html = ref.current?.innerHTML;
    if (!html) return;

    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) {
      toast("Popup diblokir browser. Izinkan popup untuk mencetak struk.", "error");
      return;
    }

    w.document.write(`<!doctype html><html><head><title>Struk ${transaction!.code}</title>
      <meta charset="utf-8">
      <style>
        @page { size: 58mm auto; margin: 3mm; }
        body { font-family: ui-monospace, "Courier New", monospace; font-size: 11px; color: #000; margin: 0; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .sep { border-top: 1px dashed #000; margin: 6px 0; }
        .muted { color: #444; }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 250);
  }

  async function share() {
    const lines = [
      store?.name ?? "Warkas",
      `Struk ${transaction!.code}`,
      tanggalJam(transaction!.created_at),
      "",
      ...(transaction!.items ?? []).map(
        (i) => `${i.qty}x ${i.product_name}  ${rupiah(i.subtotal, prefix)}`,
      ),
      "",
      `Total: ${rupiah(transaction!.total, prefix)}`,
      `Bayar (${PAYMENT_METHOD_LABEL[transaction!.payment_method]}): ${rupiah(transaction!.paid_amount, prefix)}`,
      `Kembali: ${rupiah(transaction!.change_amount, prefix)}`,
      "",
      store?.receipt_footer ?? "Terima kasih",
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: `Struk ${transaction!.code}`, text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        toast("Struk disalin ke clipboard", "success");
      }
    } catch {
      // Dibatalkan pengguna — tidak perlu ditandai sebagai error.
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transaksi berhasil"
      description={`Struk ${transaction.code}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => void share()}>
            <Share2 className="size-4" /> Kirim digital
          </Button>
          <Button variant="outline" onClick={print}>
            <Printer className="size-4" /> Cetak
          </Button>
          <Button onClick={onClose}>Transaksi baru</Button>
        </>
      }
    >
      <div className="rounded-xl bg-slate-50 p-4">
        <div ref={ref} className="mx-auto max-w-[280px] font-mono text-[11px] leading-relaxed text-slate-900">
          <div className="center" style={{ textAlign: "center" }}>
            <div className="bold" style={{ fontWeight: 700 }}>
              {store?.name ?? "Warkas"}
            </div>
            {store?.address && <div className="muted">{store.address}</div>}
            {store?.phone && <div className="muted">{store.phone}</div>}
          </div>

          <div className="sep" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>No</span>
            <span>{transaction.code}</span>
          </div>
          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Waktu</span>
            <span>{tanggalJam(transaction.created_at)}</span>
          </div>
          {cashierName && (
            <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Kasir</span>
              <span>{cashierName}</span>
            </div>
          )}

          <div className="sep" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

          {(transaction.items ?? []).map((item) => (
            <div key={item.id ?? item.product_name} style={{ marginBottom: 4 }}>
              <div>{item.product_name}</div>
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">
                  {item.qty} x {rupiah(item.price_at_sale, prefix)}
                </span>
                <span>{rupiah(item.subtotal, prefix)}</span>
              </div>
              {Number(item.discount) > 0 && (
                <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Diskon item</span>
                  <span>-{rupiah(item.discount, prefix)}</span>
                </div>
              )}
            </div>
          ))}

          <div className="sep" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span>
            <span>{rupiah(transaction.subtotal, prefix)}</span>
          </div>
          {Number(transaction.discount) > 0 && (
            <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Diskon</span>
              <span>-{rupiah(transaction.discount, prefix)}</span>
            </div>
          )}
          <div
            className="row bold"
            style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}
          >
            <span>TOTAL</span>
            <span>{rupiah(transaction.total, prefix)}</span>
          </div>
          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{PAYMENT_METHOD_LABEL[transaction.payment_method]}</span>
            <span>{rupiah(transaction.paid_amount, prefix)}</span>
          </div>
          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Kembali</span>
            <span>{rupiah(transaction.change_amount, prefix)}</span>
          </div>

          <div className="sep" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

          <div className="center" style={{ textAlign: "center" }}>
            {store?.receipt_footer ?? "Terima kasih telah berbelanja"}
          </div>
          {transaction.is_simulation && (
            <div
              className="center bold"
              style={{ textAlign: "center", fontWeight: 700, marginTop: 6 }}
            >
              *** DATA SIMULASI ***
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
