"use server";

import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createSale,
  updateSale,
  updateSaleStatus,
  deleteSale,
  cancelSale,
  duplicateSale,
  hardDeleteSale,
  markSaleReturned,
  markSaleLost,
  getSaleById,
  type PaymentTerms,
  type SalePaymentSplit,
} from "@/lib/services/sale.service";

// Hard delete and other destructive ops are admin-only. Mirrors the
// inline check in app/(tenant)/admin/actions.ts so we don't have to
// pull a shared helper into lib/.
function ensureAdminRole(role: string | null) {
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    throw new Error("Forbidden");
  }
}
import { findOrCreateCustomerByNamePhone } from "@/lib/services/customer.service";
import {
  getCachedProducts,
  getCachedCustomers,
  getCachedPaymentMethods,
} from "@/lib/cache";
import { revalidatePath } from "next/cache";

// Distinct creators of sales in the current tenant. Drives the
// "All Users" dropdown in the TopBar — fetched lazily on first open
// of the popover to keep the layout server-render cheap.
export async function getSalesCreators() {
  const session = await requireTenant();
  const rows = await prisma.sale.findMany({
    where: { tenantId: session.tenantId, isDeleted: false, createdBy: { not: null } },
    distinct: ["createdBy"],
    select: { creator: { select: { id: true, fullName: true } } },
    take: 100,
  });
  return rows
    .map((r) => r.creator)
    .filter((c): c is { id: string; fullName: string } => !!c)
    .map((c) => ({ id: c.id, name: c.fullName }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Fetched lazily by the New Sale dialog when it first opens — avoids
// loading all products/customers on every page render. Now also
// flattens variants under each product (so the form can offer a
// variant picker) and surfaces the enriched PaymentMethod fields
// (defaultTerms / defaultPaidBehavior / sortOrder) so the form can
// auto-prefill payment terms when the user picks a method.
export async function getNewSaleFormData() {
  const session = await requireTenant();
  const [products, customers, paymentMethods] = await Promise.all([
    getCachedProducts(session.tenantId),
    getCachedCustomers(session.tenantId),
    getCachedPaymentMethods(session.tenantId),
  ]);
  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      rate: Number(p.rate),
      stockQuantity: p.stockQuantity,
      variants: (p.variants ?? []).map((v) => ({
        id: v.id,
        // attributes is JSON ({ Color: "Red", Size: "M" }) — flatten
        // to "Red / M" so the picker has a human label without re-
        // mapping per-render.
        label: Object.values(
          (v.attributes as Record<string, string>) ?? {}
        ).join(" / "),
        sku: v.sku,
        rate: v.rate !== null && v.rate !== undefined ? Number(v.rate) : Number(p.rate),
        stockQuantity: v.stockQuantity,
      })),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      whatsapp: c.whatsapp,
    })),
    paymentMethods: paymentMethods
      .map((m) => ({
        id: m.id,
        name: m.name,
        // `key` is nullable on legacy rows that pre-date the
        // backfill migration. Fall back to the slug-of-name so the
        // form can still match by it.
        key:
          m.key ??
          m.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, ""),
        type: m.type,
        defaultTerms: m.defaultTerms as PaymentTerms,
        defaultPaidBehavior: m.defaultPaidBehavior as
          | "full"
          | "zero"
          | "custom",
        sortOrder: m.sortOrder,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  };
}

export async function createSaleAction(formData: FormData) {
  const session = await requireTenant();

  // Parse line items: items_<n>_productId, items_<n>_quantity, items_<n>_unitPrice
  const items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }> = [];

  const itemsJson = formData.get("itemsJson") as string;
  if (itemsJson) {
    try {
      const parsed = JSON.parse(itemsJson) as any[];
      for (const it of parsed) {
        if (it.productId && it.quantity && it.unitPrice >= 0) {
          items.push({
            productId: it.productId,
            variantId: it.variantId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          });
        }
      }
    } catch {
      throw new Error("Invalid item data");
    }
  }

  if (items.length === 0) throw new Error("Add at least one item to the sale");

  // saleDate (yyyy-mm-dd) overrides createdAt — used by the New Sale
  // dialog so back-dating / post-dating an entry works. Time-of-day is
  // copied from the current moment so the order within a day is sane.
  let saleDate: Date | undefined;
  const rawSaleDate = formData.get("saleDate") as string | null;
  if (rawSaleDate && /^\d{4}-\d{2}-\d{2}$/.test(rawSaleDate)) {
    const [y, m, d] = rawSaleDate.split("-").map(Number);
    const now = new Date();
    saleDate = new Date(
      y,
      m - 1,
      d,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    );
  }

  // Payment splits — multiple methods can each cover a portion of the
  // grand total. The form posts a JSON array; rows with amount <= 0 are
  // dropped server-side.
  let paymentSplits: SalePaymentSplit[] | undefined;
  const splitsJson = formData.get("paymentSplitsJson") as string | null;
  if (splitsJson) {
    try {
      const parsed = JSON.parse(splitsJson) as Array<{
        method?: unknown;
        amount?: unknown;
      }>;
      paymentSplits = parsed
        .map((s) => ({
          method: typeof s.method === "string" && s.method ? s.method : "cash",
          amount: Number(s.amount) || 0,
        }))
        .filter((s) => s.amount > 0);
      if (paymentSplits.length === 0) paymentSplits = undefined;
    } catch {
      throw new Error("Invalid payment splits");
    }
  }

  // Payment terms gate the credit-days / due-date fields. "credit" is
  // the only term where creditDays is meaningful.
  const rawTerms = (formData.get("paymentTerms") as string) || "immediate";
  const paymentTerms: PaymentTerms =
    rawTerms === "cod" || rawTerms === "credit" ? rawTerms : "immediate";

  let creditDays: number | undefined;
  if (paymentTerms === "credit") {
    const raw = formData.get("creditDays") as string | null;
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n > 0) creditDays = n;
  }

  const explicitAmountPaid = formData.get("amountPaid");
  const amountPaid =
    explicitAmountPaid !== null && explicitAmountPaid !== ""
      ? parseFloat(explicitAmountPaid as string)
      : undefined;

  // Customer resolution: an existing customerId wins. Otherwise, auto
  // match-or-create on (name + phone) so cashiers can type a returning
  // customer's details without picking from a dropdown and not produce
  // duplicate rows.
  const customerName = (formData.get("customerName") as string) || "";
  const customerPhone =
    (formData.get("customerPhone") as string) || undefined;
  const customerAddress =
    (formData.get("customerAddress") as string) || undefined;
  const customerWhatsapp =
    (formData.get("customerWhatsapp") as string) || undefined;
  const explicitCustomerId =
    (formData.get("customerId") as string) || undefined;

  const customerId =
    explicitCustomerId ||
    (customerName.trim()
      ? await findOrCreateCustomerByNamePhone(
          session.tenantId,
          session.userId,
          {
            name: customerName.trim(),
            phone: customerPhone,
            address: customerAddress,
            whatsapp: customerWhatsapp,
          }
        )
      : undefined);

  const sale = await createSale(session.tenantId, session.userId, {
    customerName,
    customerPhone,
    customerAddress,
    customerWhatsapp,
    customerId,
    paymentMethod: formData.get("paymentMethod") as string,
    paymentStatus: (formData.get("paymentStatus") as string) || undefined,
    discountAmount: formData.get("discountAmount")
      ? parseFloat(formData.get("discountAmount") as string)
      : 0,
    charge: formData.get("charge")
      ? parseFloat(formData.get("charge") as string)
      : 0,
    additionalInfo: (formData.get("additionalInfo") as string) || undefined,
    saleDate,
    paymentTerms,
    creditDays,
    paymentSplits,
    amountPaid,
    items,
  });

  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return sale;
}

export async function updateSaleStatusAction(formData: FormData) {
  const session = await requireTenant();
  await updateSaleStatus(session.tenantId, session.userId, {
    saleId: formData.get("saleId") as string,
    paymentStatus: (formData.get("paymentStatus") as string) || undefined,
    orderStatus: (formData.get("orderStatus") as string) || undefined,
    courierStatus: (formData.get("courierStatus") as string) || undefined,
    courierName: (formData.get("courierName") as string) || undefined,
    consignmentId: (formData.get("consignmentId") as string) || undefined,
    cnNumber: (formData.get("cnNumber") as string) || undefined,
    amountPaid: formData.get("amountPaid")
      ? parseFloat(formData.get("amountPaid") as string)
      : undefined,
  });
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/packaging");
  revalidatePath("/dashboard");
}

export async function deleteSaleAction(formData: FormData) {
  const session = await requireTenant();
  await deleteSale(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function duplicateSaleAction(formData: FormData) {
  const session = await requireTenant();
  const sale = await duplicateSale(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return sale;
}

// Bulk-set the courier status for several sales in one round trip.
// Used by the "Bulk Status" header control on the listing — the
// cashier checks several rows, picks a status, and applies.
export async function bulkUpdateCourierStatusAction(formData: FormData) {
  const session = await requireTenant();
  const idsRaw = (formData.get("saleIds") as string) ?? "";
  const courierStatus = (formData.get("courierStatus") as string) ?? "";
  if (!courierStatus) throw new Error("Courier status is required");
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error("Select at least one sale");
  for (const id of ids) {
    await updateSaleStatus(session.tenantId, session.userId, {
      saleId: id,
      courierStatus,
    });
  }
  revalidatePath("/sales");
  revalidatePath("/packaging");
}

export async function cancelSaleAction(formData: FormData) {
  const session = await requireTenant();
  await cancelSale(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

// ─── Returned / Lost lifecycle ──────────────────────────────
// Same shape as cancelSaleAction. Each transition is a once-only
// stock-restore + status flip; the underlying service guards
// against double-restore via the inventoryRestored flag.

export async function markSaleReturnedAction(formData: FormData) {
  const session = await requireTenant();
  await markSaleReturned(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function markSaleLostAction(formData: FormData) {
  const session = await requireTenant();
  await markSaleLost(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

// ─── Hard delete (admin only) ───────────────────────────────
// Permanently removes the sale row. Admins only — gated here AND in
// the admin Trash UI; the service itself does not enforce role.

export async function hardDeleteSaleAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdminRole(session.role);
  await hardDeleteSale(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/admin");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

// ─── Get one sale (used by Edit + View dialogs) ─────────────
// Server action so the client doesn't need a fetch route — react
// can call it directly from a useEffect in the dialog open path.
// Returns plain JSON-able shape (Decimals → numbers).

export async function getSaleAction(saleId: string) {
  const session = await requireTenant();
  const sale = await getSaleById(session.tenantId, saleId);
  if (!sale) throw new Error("Sale not found");
  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerAddress: sale.customerAddress,
    customerWhatsapp: sale.customerWhatsapp,
    subtotal: Number(sale.subtotal),
    discountPercent: Number(sale.discountPercent),
    discountAmount: Number(sale.discountAmount),
    charge: Number(sale.charge),
    grandTotal: Number(sale.grandTotal),
    amountPaid: Number(sale.amountPaid),
    amountDue: Number(sale.amountDue),
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
    paymentTerms: sale.paymentTerms,
    creditDays: sale.creditDays,
    dueDate: sale.dueDate ? sale.dueDate.toISOString() : null,
    courierStatus: sale.courierStatus,
    courierName: sale.courierName,
    cnNumber: sale.cnNumber,
    additionalInfo: sale.additionalInfo,
    createdAt: sale.createdAt.toISOString(),
    creator: sale.creator
      ? { id: sale.creator.id, name: sale.creator.fullName, email: sale.creator.email }
      : null,
    items: sale.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      variantId: it.variantId,
      productName: it.product?.name ?? "(deleted product)",
      variantLabel: it.variant
        ? Object.values(
            (it.variant.attributes as Record<string, string>) ?? {}
          ).join(" / ")
        : null,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount),
    })),
  };
}

// ─── Update sale (full edit) ────────────────────────────────
// Same FormData shape as createSaleAction so the form doesn't have
// to know which mode it's in — it just changes which action it
// posts to. saleId is the only extra field.

export async function updateSaleAction(formData: FormData) {
  const session = await requireTenant();
  const saleId = formData.get("saleId") as string;
  if (!saleId) throw new Error("Missing saleId");

  const itemsJson = formData.get("itemsJson") as string;
  const items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }> = [];
  if (itemsJson) {
    try {
      const parsed = JSON.parse(itemsJson) as any[];
      for (const it of parsed) {
        if (it.productId && it.quantity && it.unitPrice >= 0) {
          items.push({
            productId: it.productId,
            variantId: it.variantId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          });
        }
      }
    } catch {
      throw new Error("Invalid item data");
    }
  }
  if (items.length === 0) throw new Error("Add at least one item to the sale");

  let saleDate: Date | undefined;
  const rawSaleDate = formData.get("saleDate") as string | null;
  if (rawSaleDate && /^\d{4}-\d{2}-\d{2}$/.test(rawSaleDate)) {
    const [y, m, d] = rawSaleDate.split("-").map(Number);
    const now = new Date();
    saleDate = new Date(
      y, m - 1, d,
      now.getHours(), now.getMinutes(), now.getSeconds()
    );
  }

  let paymentSplits: SalePaymentSplit[] | undefined;
  const splitsJson = formData.get("paymentSplitsJson") as string | null;
  if (splitsJson) {
    try {
      const parsed = JSON.parse(splitsJson) as Array<{ method?: unknown; amount?: unknown }>;
      paymentSplits = parsed
        .map((s) => ({
          method: typeof s.method === "string" && s.method ? s.method : "cash",
          amount: Number(s.amount) || 0,
        }))
        .filter((s) => s.amount > 0);
      if (paymentSplits.length === 0) paymentSplits = undefined;
    } catch {
      throw new Error("Invalid payment splits");
    }
  }

  const rawTerms = (formData.get("paymentTerms") as string) || "immediate";
  const paymentTerms: PaymentTerms =
    rawTerms === "cod" || rawTerms === "credit" ? rawTerms : "immediate";

  let creditDays: number | undefined;
  if (paymentTerms === "credit") {
    const raw = formData.get("creditDays") as string | null;
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n > 0) creditDays = n;
  }

  const explicitAmountPaid = formData.get("amountPaid");
  const amountPaid =
    explicitAmountPaid !== null && explicitAmountPaid !== ""
      ? parseFloat(explicitAmountPaid as string)
      : undefined;

  const customerId =
    (formData.get("customerId") as string | null) || null;

  const sale = await updateSale(session.tenantId, session.userId, {
    saleId,
    customerId,
    customerName: (formData.get("customerName") as string) || "",
    customerPhone: (formData.get("customerPhone") as string) || undefined,
    customerAddress: (formData.get("customerAddress") as string) || undefined,
    customerWhatsapp: (formData.get("customerWhatsapp") as string) || undefined,
    paymentMethod: formData.get("paymentMethod") as string,
    paymentStatus: (formData.get("paymentStatus") as string) || undefined,
    discountAmount: formData.get("discountAmount")
      ? parseFloat(formData.get("discountAmount") as string)
      : 0,
    charge: formData.get("charge")
      ? parseFloat(formData.get("charge") as string)
      : 0,
    additionalInfo: (formData.get("additionalInfo") as string) || undefined,
    saleDate,
    paymentTerms,
    creditDays,
    paymentSplits,
    amountPaid,
    items,
  });

  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  return sale;
}
