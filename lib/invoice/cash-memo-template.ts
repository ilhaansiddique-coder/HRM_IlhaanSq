import type {
  InvoiceBusiness,
  InvoiceSale,
  InvoiceSaleItem,
  InvoiceSystem,
} from "./types";
import { escapeHtml } from "./html-sanitizer";

function formatCurrency(n: number, sym: string): string {
  const hasFraction = !Number.isInteger(n);
  return `${sym}${n.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`;
}

function formatDate(iso: string, fmt: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return fmt
    .replace("dd", dd)
    .replace("MM", mm)
    .replace("yyyy", yyyy);
}

function formatTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Group identical items (same product, same unit price), merging variants.
type Group = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

function groupItems(items: InvoiceSaleItem[]): Group[] {
  const map = new Map<
    string,
    {
      name: string;
      qty: number;
      price: number;
      total: number;
      variants: Map<string, number>;
      order: string[];
    }
  >();

  for (const it of items) {
    const unit = it.unitPrice;
    const key = `${it.productName}__${unit}`;
    const variantLabel = it.variantLabel ?? null;

    const existing = map.get(key);
    if (existing) {
      existing.qty += it.quantity;
      existing.total += it.totalPrice;
      if (variantLabel) {
        if (!existing.variants.has(variantLabel))
          existing.order.push(variantLabel);
        existing.variants.set(
          variantLabel,
          (existing.variants.get(variantLabel) ?? 0) + it.quantity
        );
      }
    } else {
      map.set(key, {
        name: it.productName,
        qty: it.quantity,
        price: unit,
        total: it.totalPrice,
        variants: new Map(variantLabel ? [[variantLabel, it.quantity]] : []),
        order: variantLabel ? [variantLabel] : [],
      });
    }
  }

  return Array.from(map.values()).map((g) => {
    const chunks = g.order.map(
      (label, i) =>
        `<span class="variant-chunk">${
          i === 0 ? "" : "+"
        }${escapeHtml(label)}(${g.variants.get(label) ?? 0})</span>`
    );
    const description = g.order.length
      ? `${escapeHtml(g.name)} * ${chunks.join("")}`
      : escapeHtml(g.name);
    return {
      description,
      quantity: g.qty,
      unitPrice: g.price,
      total: g.total,
    };
  });
}

const MAX_ROWS = 12;

function itemRow(
  sl: number,
  desc: string,
  qty: number,
  price: string,
  total: string
): string {
  return `<div class="grid-row">
    <div class="grid-cell col-sl">${String(sl).padStart(2, "0")}</div>
    <div class="grid-cell col-desc"><div>${desc}</div></div>
    <div class="grid-cell col-qty">${qty}</div>
    <div class="grid-cell col-price">${price}</div>
    <div class="grid-cell col-amount">${total}</div>
  </div>`;
}

function emptyRow(sl: number): string {
  return `<div class="grid-row empty-row">
    <div class="grid-cell col-sl">${String(sl).padStart(2, "0")}</div>
    <div class="grid-cell col-desc">&nbsp;</div>
    <div class="grid-cell col-qty">&nbsp;</div>
    <div class="grid-cell col-price">&nbsp;</div>
    <div class="grid-cell col-amount">&nbsp;</div>
  </div>`;
}

export function generateCashMemoHtml(
  sale: InvoiceSale,
  business: InvoiceBusiness,
  system: InvoiceSystem
): string {
  const sym = system.currencySymbol || "৳";
  const address = business.addressLine1 ?? business.address ?? "";

  const chargeValue = sale.charge + sale.fee;
  const dueAmount = sale.amountDue;
  const paidAmount = sale.amountPaid;
  const discount =
    sale.discountAmount > 0
      ? sale.discountAmount
      : sale.discountPercent > 0
        ? sale.subtotal * (sale.discountPercent / 100)
        : 0;

  const method = sale.paymentMethod.toLowerCase();
  const terms = (sale.paymentTerms ?? "immediate").toLowerCase();
  const isCreditSale = terms === "credit" || method === "credit";
  const isCodSale =
    terms === "cod" || method === "cod" || (!isCreditSale && dueAmount > 0);
  const showPaidStamp = dueAmount <= 0 && !isCreditSale;
  const showCreditStamp = isCreditSale && dueAmount > 0;

  const courierName = sale.courierName ?? "";
  const isStorePickup = courierName.toLowerCase().includes("store pickup");
  const isSteadfast = courierName.toLowerCase().includes("steadfast");

  const groups = groupItems(sale.items);
  const fillCount = Math.max(0, MAX_ROWS - groups.length);

  const rowsHtml =
    groups
      .map((g, i) =>
        itemRow(
          i + 1,
          g.description,
          g.quantity,
          escapeHtml(formatCurrency(g.unitPrice, sym)),
          escapeHtml(formatCurrency(g.total, sym))
        )
      )
      .join("") +
    Array.from({ length: fillCount }, (_, i) =>
      emptyRow(groups.length + i + 1)
    ).join("");

  const logoHtml = business.logoUrl
    ? `<img src="${escapeHtml(business.logoUrl)}" alt="${escapeHtml(business.businessName)} Logo" />`
    : `<span class="logo-fallback">${escapeHtml((business.businessName || "?").charAt(0).toUpperCase())}</span>`;

  const brand = business.brandColor?.match(/^#[0-9a-f]{3,8}$/i)
    ? business.brandColor
    : "#1f8a3b";

  const condition =
    (dueAmount + chargeValue) > 0 && !isSteadfast && !isStorePickup && isCodSale
      ? `<div class="condition-line">COD = ${escapeHtml(formatCurrency(dueAmount, sym))} + Charge</div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cash Memo — ${escapeHtml(sale.invoiceNumber)}</title>
<style>
@font-face { font-family:"Manrope"; font-weight:400; src:url("/fonts/Manrope-400.woff2") format("woff2"); font-display:swap; }
@font-face { font-family:"Manrope"; font-weight:500; src:url("/fonts/Manrope-500.woff2") format("woff2"); font-display:swap; }
@font-face { font-family:"Manrope"; font-weight:600; src:url("/fonts/Manrope-600.woff2") format("woff2"); font-display:swap; }
@font-face { font-family:"Manrope"; font-weight:700; src:url("/fonts/Manrope-700.woff2") format("woff2"); font-display:swap; }
@font-face { font-family:"Manrope"; font-weight:800; src:url("/fonts/Manrope-800.woff2") format("woff2"); font-display:swap; }
@page { size: A5 portrait; margin: 0; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

:root {
  --brand: ${brand};
  --brand-dark: #0d5a25;
  --line: ${brand};
  --ink: #0a0a0a;
  --muted: #3d3d3d;
  --bg: #eff8f0;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 5px;
  min-height: 100vh;
  font: 12px/1.35 "Manrope", "Noto Sans Bengali", ui-sans-serif, system-ui, sans-serif;
  color: var(--ink);
  background: #e5e7eb;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.memo {
  width: 148mm;
  min-height: 210mm;
  background: #fff;
  border: 1px solid var(--brand);
  box-shadow: 0 2px 8px rgba(0,0,0,.1);
  display: flex;
  flex-direction: column;
  position: relative;
}
@media print {
  body { background: #fff; padding: 0; }
  .memo { box-shadow: none; border: none; }
}
.content-wrapper { flex: 1; display: flex; flex-direction: column; }
.title-top {
  text-align: right;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--brand-dark);
  letter-spacing: 3px;
  font-size: 18px;
  padding: .5mm 8mm;
  background: var(--bg);
  border: 2px solid var(--brand);
  border-bottom: none;
}
.header {
  display: grid;
  grid-template-columns: 67% 33%;
  gap: 2mm;
  padding: 0 4mm 2mm;
  background: var(--bg);
}
.header-left { display: flex; gap: 4mm; margin-top: -20px; padding-top: 1px; }
.logo {
  width: 16mm; height: 16mm;
  border: 2px solid var(--brand);
  border-radius: 50%;
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}
.logo img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.logo .logo-fallback {
  font-size: 18px;
  font-weight: 800;
  color: var(--brand-dark);
}
.brand { font-weight: 800; color: var(--brand-dark); font-size: 16px; letter-spacing: .8px; }
.tag { font-size: 7.5px; color: var(--muted); white-space: nowrap; }
.header-contact div { font-size: 11px; line-height: 1.3; }
.serial { font-size: 11px; }
.serial b { color: var(--brand-dark); padding-left: 2mm; }
.header-right {
  font-size: 12px;
  line-height: 1.25;
  margin-top: 9px;
  padding-left: 2px;
  word-break: break-word;
  position: relative;
}
.header-right:before {
  content: "";
  position: absolute;
  left: -1.5mm;
  top: 0;
  bottom: -11px;
  width: 2px;
  background: var(--brand);
}
.header-right .row { margin-bottom: .5mm; }
.table-wrap { padding: 4px 5mm 1mm; }
.items-grid { width: 100%; border: 1px solid var(--line); font-size: 10.5px; }
.grid-row { display: flex; border-bottom: 1px solid var(--line); align-items: stretch; }
.grid-row:last-child { border-bottom: none; }
.grid-row.header-row { background: rgba(31,138,59,.08); font-weight: 700; }
.grid-cell {
  padding: 1.4mm 1.3mm;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  word-break: break-word;
}
.grid-cell:last-child { border-right: none; }
.col-sl { width: 8%; align-items: center; }
.col-desc { width: 52%; align-items: flex-start; flex-grow: 1; text-transform: capitalize; }
.col-qty { width: 12%; align-items: center; }
.col-price { width: 14%; align-items: center; }
.col-amount { width: 14%; align-items: center; }
.variant-chunk { display: inline-block; white-space: nowrap; }
.empty-row .grid-cell { min-height: 5mm; }
.totals {
  display: grid;
  grid-template-columns: 1fr 45mm;
  gap: 4mm;
  margin-top: 2mm;
  padding: 0 5mm;
  align-items: start;
}
.left-section { display: flex; flex-direction: column; gap: 2mm; }
.note { font-size: 11.5px; color: var(--muted); }
.courier-name { font-size: 16px; font-weight: 700; }
.courier-cn .cn-value { font-size: 14px; font-weight: 700; }
.condition-line { font-size: 13px; font-weight: 700; margin-top: 1mm; }
.sum { border: 1px solid var(--line); }
.sum .row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--line);
  align-items: start;
}
.sum .row:last-child { border-bottom: none; }
.sum .k {
  padding: 2mm;
  background: rgba(31,138,59,.06);
  font-weight: 700;
  font-size: 12px;
}
.sum .v {
  padding: 2mm;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
.paid-stamp, .credit-stamp {
  display: inline-block;
  align-self: flex-start;
  width: fit-content;
  margin-top: 2.5mm;
  padding: 2.5mm 7mm;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-size: 16px;
  border-radius: 2mm;
  transform: rotate(-8deg);
  border: 2px solid currentColor;
}
.paid-stamp { color: #7ac943; }
.credit-stamp { color: #dc2626; }
.signs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6mm;
  padding: 1mm 6mm 2mm;
  margin-top: auto;
  min-height: 16mm;
}
.sig {
  position: relative;
  padding-top: 10mm;
  text-align: center;
  font-size: 10px;
  color: var(--muted);
}
.sig:before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 7mm;
  height: 0;
  border-top: 1px solid var(--brand);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2mm;
  padding: 1mm 6mm 1.5mm;
  border-top: 2px solid var(--brand);
  background: linear-gradient(180deg, #fff 0%, var(--bg) 100%);
  font-size: 10.5px;
}
.footer .ayah { flex: 1; padding: .5mm 2mm; border-left: 3px solid var(--brand); }
.footer .printed-at { font-size: 10px; white-space: nowrap; }
</style></head>
<body>

<div class="memo">
  <div class="content-wrapper">
    <div class="title-top">INVOICE</div>

    <div class="header">
      <div class="header-left">
        <div class="logo">${logoHtml}</div>
        <div>
          <div class="brand">${escapeHtml((business.businessName || "YOUR BRAND").toUpperCase())}</div>
          ${business.tagline ? `<div class="tag">${escapeHtml(business.tagline)}</div>` : ""}
          <div class="header-contact" style="margin-top:.5mm">
            ${business.phone ? `<div><strong>Phone:</strong> ${escapeHtml(business.phone)}${business.whatsapp && business.whatsapp !== business.phone ? ` | ${escapeHtml(business.whatsapp)}` : ""}</div>` : ""}
            ${business.email ? `<div><strong>Email:</strong> ${escapeHtml(business.email)}</div>` : ""}
            ${address ? `<div><strong>Address:</strong> ${escapeHtml(address)}</div>` : ""}
          </div>
          <div class="serial" style="margin-top:1mm">INV NO: <b>${escapeHtml(sale.invoiceNumber)}</b></div>
        </div>
      </div>

      <div class="header-right">
        <div class="row"><strong>Name:</strong> ${escapeHtml(sale.customerName || "Walk-in Customer")}</div>
        <div class="row"><strong>Address:</strong> ${escapeHtml(sale.customerAddress || "-")}</div>
        <div class="row"><strong>Phone:</strong> ${escapeHtml(sale.customerPhone || "-")}</div>
        <div class="row"><strong>Date:</strong> ${escapeHtml(formatDate(sale.createdAt, system.dateFormat))}</div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="items-grid">
        <div class="grid-row header-row">
          <div class="grid-cell col-sl">SL.</div>
          <div class="grid-cell col-desc">Item Description</div>
          <div class="grid-cell col-qty">Qty.</div>
          <div class="grid-cell col-price">Price</div>
          <div class="grid-cell col-amount">Amount</div>
        </div>
        ${rowsHtml}
      </div>

      <div class="totals">
        <div class="left-section">
          ${business.invoiceFooterMessage ? `<div class="note">${escapeHtml(business.invoiceFooterMessage)}</div>` : ""}
          ${courierName ? `<div class="courier-name"><strong>${isStorePickup ? escapeHtml(courierName) : `Courier: ${escapeHtml(courierName)}`}</strong></div>` : ""}
          ${sale.cnNumber ? `<div class="courier-cn"><span class="cn-value">#${escapeHtml(sale.cnNumber)}</span></div>` : ""}
          ${sale.additionalInfo ? `<div class="note">${escapeHtml(sale.additionalInfo)}</div>` : ""}
          ${condition}
          ${showPaidStamp ? `<div class="paid-stamp">Paid</div>` : ""}
          ${showCreditStamp ? `<div class="credit-stamp">Credit</div>` : ""}
        </div>
        <div class="sum">
          ${chargeValue > 0 ? `<div class="row"><div class="k">Charge</div><div class="v">${escapeHtml(formatCurrency(chargeValue, sym))}</div></div>` : ""}
          <div class="row"><div class="k">Total</div><div class="v">${escapeHtml(formatCurrency((sale.subtotal) + chargeValue, sym))}</div></div>
          ${discount > 0 ? `<div class="row"><div class="k">Discount</div><div class="v">-${escapeHtml(formatCurrency(discount, sym))}</div></div>` : ""}
          ${paidAmount > 0 && !isCreditSale ? `<div class="row"><div class="k">Adv</div><div class="v">${escapeHtml(formatCurrency(paidAmount, sym))}</div></div>` : ""}
          ${dueAmount > 0 ? `<div class="row"><div class="k">Due</div><div class="v">${escapeHtml(formatCurrency(dueAmount, sym))}</div></div>` : ""}
        </div>
      </div>
    </div>

    <div class="signs">
      <div class="sig">Customer's sign</div>
      <div class="sig">Merchant's sign</div>
    </div>
  </div>

  <div class="footer">
    <div class="ayah">আল্লাহ ব্যবসায়কে হালাল এবং সুদকে হারাম করেছেন (সূরা বাকারা : ২৭৫)</div>
    <div class="printed-at">Printed At: ${formatTime()}</div>
  </div>
</div>

</body></html>`;
}
