// Plain shapes consumed by the invoice/cash-memo generators.
// Always convert Prisma Decimal -> number before passing in (via toSaleData).

export type InvoiceSaleItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantLabel?: string | null;
};

export type InvoiceSale = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerWhatsapp: string | null;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  charge: number;
  fee: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentTerms?: string;
  courierName: string | null;
  cnNumber: string | null;
  additionalInfo: string | null;
  items: InvoiceSaleItem[];
};

export type InvoiceBusiness = {
  businessName: string;
  tagline?: string | null;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  addressLine1: string | null;
  invoiceFooterMessage: string | null;
  brandColor: string | null;
};

export type InvoiceSystem = {
  currencySymbol: string;
  dateFormat: string;
};

// ─── Adapter: Prisma shape -> plain invoice shape ────────────
// Accepts the raw Prisma Sale (with Decimal fields) + relations, produces
// fully-serializable InvoiceSale. Use from server components only.

type DecimalLike = { toString(): string } | number | string | null | undefined;

const toNumber = (v: DecimalLike): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(typeof v === "string" ? v : v.toString());
  return Number.isFinite(n) ? n : 0;
};

const toString = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.length ? v : null;
  return String(v);
};

type PrismaSaleLike = {
  id: string;
  invoiceNumber: string;
  createdAt: Date | string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerWhatsapp: string | null;
  subtotal: DecimalLike;
  discountPercent: DecimalLike;
  discountAmount: DecimalLike;
  charge: DecimalLike;
  fee: DecimalLike;
  grandTotal: DecimalLike;
  amountPaid: DecimalLike;
  amountDue: DecimalLike;
  paymentMethod: string;
  paymentStatus: string;
  paymentTerms?: string | null;
  courierName: string | null;
  cnNumber: string | null;
  additionalInfo: string | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: DecimalLike;
    totalPrice: DecimalLike;
    product?: { name?: string | null } | null;
    variant?: { attributes?: unknown } | null;
  }>;
};

function formatVariantLabel(attrs: unknown): string | null {
  if (!attrs) return null;
  if (typeof attrs === "string") return attrs || null;
  if (Array.isArray(attrs)) return attrs.filter(Boolean).join(" / ") || null;
  if (typeof attrs === "object") {
    const values = Object.values(attrs as Record<string, unknown>)
      .filter((v) => typeof v === "string" && v.length > 0)
      .map((v) => String(v));
    return values.length ? values.join(" / ") : null;
  }
  return null;
}

export function toInvoiceSale(sale: PrismaSaleLike): InvoiceSale {
  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    createdAt:
      sale.createdAt instanceof Date
        ? sale.createdAt.toISOString()
        : String(sale.createdAt),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerAddress: sale.customerAddress,
    customerWhatsapp: sale.customerWhatsapp,
    subtotal: toNumber(sale.subtotal),
    discountPercent: toNumber(sale.discountPercent),
    discountAmount: toNumber(sale.discountAmount),
    charge: toNumber(sale.charge),
    fee: toNumber(sale.fee),
    grandTotal: toNumber(sale.grandTotal),
    amountPaid: toNumber(sale.amountPaid),
    amountDue: toNumber(sale.amountDue),
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
    paymentTerms: sale.paymentTerms ?? undefined,
    courierName: sale.courierName,
    cnNumber: sale.cnNumber,
    additionalInfo: sale.additionalInfo,
    items: sale.items.map((it) => ({
      id: it.id,
      productName: it.product?.name ?? "Item",
      quantity: it.quantity,
      unitPrice: toNumber(it.unitPrice),
      totalPrice: toNumber(it.totalPrice),
      variantLabel: formatVariantLabel(it.variant?.attributes),
    })),
  };
}

export function toInvoiceBusiness(b: {
  businessName?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  primaryEmail?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  invoiceFooterMessage?: string | null;
  brandColor?: string | null;
} | null | undefined): InvoiceBusiness {
  return {
    businessName: b?.businessName ?? "Your Business",
    tagline: null,
    logoUrl: b?.logoUrl ?? null,
    phone: toString(b?.phone),
    whatsapp: toString(b?.whatsapp),
    email: toString(b?.primaryEmail ?? b?.email),
    address: toString(b?.address),
    addressLine1: toString(b?.addressLine1 ?? b?.address),
    invoiceFooterMessage: toString(b?.invoiceFooterMessage),
    brandColor: toString(b?.brandColor),
  };
}

export function toInvoiceSystem(s: {
  currencySymbol?: string | null;
  dateFormat?: string | null;
} | null | undefined): InvoiceSystem {
  return {
    currencySymbol: s?.currencySymbol ?? "৳",
    dateFormat: s?.dateFormat ?? "dd/MM/yyyy",
  };
}
