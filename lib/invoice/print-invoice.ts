import type { InvoiceBusiness, InvoiceSale, InvoiceSystem } from "./types";
import { generateCashMemoHtml } from "./cash-memo-template";

/**
 * Opens the system print dialog with the cash memo pre-rendered.
 * Must be called synchronously from a user click (popup-blocker constraint).
 */
export function printCashMemo(
  sale: InvoiceSale,
  business: InvoiceBusiness,
  system: InvoiceSystem
): void {
  const html = generateCashMemoHtml(sale, business, system);
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) {
    alert(
      "Your browser blocked the print window. Please allow popups for this site and try again."
    );
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();

  const triggerPrint = async () => {
    try {
      const fonts = (w.document as unknown as { fonts?: FontFaceSet }).fonts;
      if (fonts?.ready) await fonts.ready;
    } catch {
      // font readiness is a best-effort; proceed anyway
    }
    // Small delay so images on the page can render
    await new Promise((r) => setTimeout(r, 150));
    w.focus();
    w.print();
  };

  if (w.document.readyState === "complete") {
    void triggerPrint();
  } else {
    w.onload = () => void triggerPrint();
  }
}
