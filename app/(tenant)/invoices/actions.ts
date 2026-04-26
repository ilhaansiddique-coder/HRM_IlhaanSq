"use server";

import { requireTenant } from "@/lib/auth";
import { prisma, tenantDb } from "@/lib/db";
import {
  toInvoiceBusiness,
  toInvoiceSale,
  toInvoiceSystem,
  type InvoiceBusiness,
  type InvoiceSale,
  type InvoiceSystem,
} from "@/lib/invoice/types";

// Returns the three things the cash-memo generator needs, in plain
// JSON-able shapes (Decimals/Dates already normalized via `toInvoice*`).
//
// Tenant scoping:
//   • Super admin can fetch any tenant's invoice — the business and
//     system settings are read from the SALE'S OWNING TENANT, not the
//     viewer's, so the printed cash memo has the correct company
//     header/logo regardless of which super admin is viewing it.
//   • Tenant user is auto-scoped to their own tenant via tenantDb().
//
// Used by the row-level View / Print / Download icons in InvoiceList
// — mirrors the Vite reference's `getSaleWithItems` + cached settings
// chain that feeds `generateCashMemoHTML`.
export async function getInvoicePayloadAction(saleId: string): Promise<{
  sale: InvoiceSale;
  business: InvoiceBusiness;
  system: InvoiceSystem;
}> {
  const session = await requireTenant();

  const baseInclude = {
    items: { include: { product: true, variant: true } },
    customer: true,
  } as const;

  const sale = session.isSuperAdmin
    ? await prisma.sale.findFirst({
        where: { id: saleId },
        include: baseInclude,
      })
    : await tenantDb(session.tenantId).sale.findFirst({
        where: { id: saleId },
        include: baseInclude,
      });

  if (!sale) throw new Error("Invoice not found");

  // Pull settings from the SALE'S tenant (not necessarily the
  // viewer's — important for super-admin cross-tenant views).
  const [business, system] = await Promise.all([
    prisma.businessSettings.findFirst({ where: { tenantId: sale.tenantId } }),
    prisma.systemSettings.findFirst({ where: { tenantId: sale.tenantId } }),
  ]);

  return {
    sale: toInvoiceSale(sale),
    business: toInvoiceBusiness(business),
    system: toInvoiceSystem(system),
  };
}

// ─── Rich detail payload for the in-app View dialog ─────────
// Returns everything the InvoiceViewDialog needs to render the
// full invoice card (header / KPIs / customer / pricing / items
// with images / activity log). Separate from getInvoicePayloadAction
// because the cash-memo template doesn't need product images,
// activity logs, or courier status.

export type InvoiceDetailRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  dueDate: string | null;
  customerName: string;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  customerAddress: string | null;
  subtotal: number;
  discountAmount: number;
  charge: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentTerms: string;
  courierName: string | null;
  courierStatus: string | null;
  cnNumber: string | null;
  updatedAt: string;
  creator: { id: string; name: string } | null;
  items: Array<{
    id: string;
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl: string | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    summary: string | null;
    createdAt: string;
    user: { id: string; name: string } | null;
    details: unknown;
  }>;
};

const flattenVariantLabel = (attrs: unknown): string | null => {
  if (!attrs || typeof attrs !== "object") return null;
  const values = Object.values(attrs as Record<string, unknown>)
    .filter((v) => typeof v === "string" && v.length > 0)
    .map((v) => String(v));
  return values.length ? values.join(" / ") : null;
};

export async function getInvoiceDetailsAction(
  saleId: string
): Promise<InvoiceDetailRow> {
  const session = await requireTenant();

  const include = {
    items: { include: { product: true, variant: true } },
    creator: { select: { id: true, fullName: true } },
  } as const;

  const sale = session.isSuperAdmin
    ? await prisma.sale.findFirst({
        where: { id: saleId },
        include,
      })
    : await tenantDb(session.tenantId).sale.findFirst({
        where: { id: saleId },
        include,
      });

  if (!sale) throw new Error("Invoice not found");

  // Activity logs scoped to this sale entity. tenant scoping
  // mirrors the sale: super admin can see any tenant's logs.
  const activityWhere = {
    entityType: "sales" as const,
    entityId: saleId,
    ...(session.isSuperAdmin ? {} : { tenantId: session.tenantId }),
  };
  const activity = await prisma.activityLog.findMany({
    where: activityWhere,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, fullName: true } } },
  });

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt.toISOString(),
    dueDate: sale.dueDate ? sale.dueDate.toISOString() : null,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerWhatsapp: sale.customerWhatsapp,
    customerAddress: sale.customerAddress,
    subtotal: Number(sale.subtotal ?? 0),
    discountAmount: Number(sale.discountAmount ?? 0),
    charge: Number(sale.charge ?? 0),
    grandTotal: Number(sale.grandTotal ?? 0),
    amountPaid: Number(sale.amountPaid ?? 0),
    amountDue: Number(sale.amountDue ?? 0),
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.paymentMethod,
    paymentTerms: sale.paymentTerms ?? "immediate",
    courierName: sale.courierName,
    courierStatus: sale.courierStatus,
    cnNumber: sale.cnNumber,
    updatedAt: sale.updatedAt.toISOString(),
    creator: sale.creator
      ? { id: sale.creator.id, name: sale.creator.fullName }
      : null,
    items: sale.items.map((it) => ({
      id: it.id,
      productName: it.product?.name ?? "(deleted product)",
      variantLabel: it.variant ? flattenVariantLabel(it.variant.attributes) : null,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice ?? 0),
      totalPrice: Number(it.totalPrice ?? 0),
      imageUrl: it.variant?.imageUrl ?? it.product?.imageUrl ?? null,
    })),
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      summary:
        typeof a.details === "object" && a.details && "summary" in a.details
          ? String((a.details as { summary?: unknown }).summary ?? "")
          : null,
      createdAt: a.createdAt.toISOString(),
      user: a.user ? { id: a.user.id, name: a.user.fullName } : null,
      details: a.details,
    })),
  };
}
