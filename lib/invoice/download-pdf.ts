import type { InvoiceBusiness, InvoiceSale, InvoiceSystem } from "./types";
import { generateCashMemoHtml } from "./cash-memo-template";

// A5 portrait page size (mm)
const PAGE_W_MM = 148;
const PAGE_H_MM = 210;
const PX_PER_MM = 3.78;

/**
 * Renders the cash memo HTML inside a hidden iframe, captures it via
 * html2canvas, and downloads the result as a PDF. Keeps the iframe scoped so
 * the template's styles don't leak into the host app.
 */
export async function downloadCashMemoPdf(
  sale: InvoiceSale,
  business: InvoiceBusiness,
  system: InvoiceSystem,
  filename?: string
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const html = generateCashMemoHtml(sale, business, system);

  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${Math.ceil(PAGE_W_MM * PX_PER_MM)}px`,
    height: `${Math.ceil(PAGE_H_MM * PX_PER_MM)}px`,
    border: "none",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-9999",
  });
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Failed to create print context");
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for images to load (logo etc.)
    await Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    );
    try {
      const fonts = (doc as unknown as { fonts?: FontFaceSet }).fonts;
      if (fonts?.ready) await fonts.ready;
    } catch {
      // Font readiness is best-effort; some browsers don't expose it on iframes.
    }
    await new Promise((r) => setTimeout(r, 250));

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: Math.ceil(PAGE_W_MM * PX_PER_MM),
    });

    // Crop trailing whitespace (the A5 page has filler rows to the bottom,
    // which would otherwise balloon the PDF page height).
    const ctx = canvas.getContext("2d");
    let cropH = canvas.height;
    if (ctx) {
      for (let y = canvas.height - 1; y > 0; y -= 4) {
        const row = ctx.getImageData(0, y, canvas.width, 1).data;
        let hasInk = false;
        for (let x = 0; x < row.length; x += 16) {
          if (row[x] < 250 || row[x + 1] < 250 || row[x + 2] < 250) {
            hasInk = true;
            break;
          }
        }
        if (hasInk) {
          cropH = Math.min(canvas.height, y + 40);
          break;
        }
      }
    }

    const cropped = document.createElement("canvas");
    cropped.width = canvas.width;
    cropped.height = cropH;
    cropped
      .getContext("2d")
      ?.drawImage(canvas, 0, 0, canvas.width, cropH, 0, 0, canvas.width, cropH);

    const contentRatio = cropped.height / cropped.width;
    const pageRatio = PAGE_H_MM / PAGE_W_MM;
    const finalH =
      contentRatio > pageRatio * 1.05 ? PAGE_W_MM * contentRatio : PAGE_H_MM;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [PAGE_W_MM, finalH],
    });
    const imgW = pdf.internal.pageSize.getWidth();
    const imgH = (cropped.height * imgW) / cropped.width;
    pdf.addImage(
      cropped.toDataURL("image/png"),
      "PNG",
      0,
      0,
      imgW,
      Math.min(imgH, pdf.internal.pageSize.getHeight())
    );

    pdf.save(filename ?? `Invoice-${sale.invoiceNumber}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
