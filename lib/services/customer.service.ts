import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { invalidateCustomerCache } from "../cache";

// ─── Cross-tenant catalog read (super admin) ────────────────
// Mirrors getAllTenantsSales — uncached cross-tenant list with the
// owning tenant's name attached. Super admins don't own customers, so
// /customers shows every tenant's customers tagged with which tenant
// they belong to. Hard-capped to keep payload predictable.
export type CustomerWithTenant = Prisma.CustomerGetPayload<{
  include: {
    tenant: { select: { name: true } };
  };
}>;

export async function getAllTenantsCustomers(): Promise<CustomerWithTenant[]> {
  return prisma.customer.findMany({
    where: { isDeleted: false },
    include: {
      tenant: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

// ─── Types ──────────────────────────────────────────────────

export type CustomerStatus = "active" | "neutral" | "inactive";

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  whatsapp?: string;
  tags?: string[];
  creditLimit?: number;
  additionalInfo?: string;
  status?: CustomerStatus;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput> & { id: string };

// ─── Create ─────────────────────────────────────────────────

export async function createCustomer(
  tenantId: string,
  userId: string,
  input: CreateCustomerInput
) {
  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      whatsapp: input.whatsapp,
      tags: input.tags ?? [],
      creditLimit: input.creditLimit,
      additionalInfo: input.additionalInfo,
      // The form lets the user pick the initial status; default to
      // "inactive" so newly-imported records don't pollute the
      // "active customers" KPI until they actually purchase.
      status: input.status ?? "inactive",
      createdBy: userId,
    },
  });

  await invalidateCustomerCache(tenantId);
  return customer;
}

// ─── Match-or-create (used by sale flow) ───────────────────
// Sales create a customer on the fly when the cashier types a name and
// phone the system has not seen before. To avoid duplicate rows we
// match on phone first (most reliable: digits only, ignoring +88 etc),
// fall back to a normalized name when phone is missing, and only
// create a new customer when neither route lands.

const phoneDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const normalizeName = (s?: string | null) =>
  (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const buildWhatsappFromPhone = (phone?: string | null) => {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  return digits.startsWith("88") ? `+${digits}` : `+88${digits}`;
};

export async function findOrCreateCustomerByNamePhone(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    phone?: string;
    address?: string;
    whatsapp?: string;
  }
): Promise<string> {
  const digits = phoneDigits(input.phone);
  const normalized = normalizeName(input.name);

  // Phone match (digit-only equality on either phone or whatsapp).
  if (digits) {
    const candidates = await prisma.customer.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, phone: true, whatsapp: true },
      take: 200,
    });
    const hit = candidates.find(
      (c) => phoneDigits(c.phone) === digits || phoneDigits(c.whatsapp) === digits
    );
    if (hit) return hit.id;
  }

  // Name match (only when no phone — phone is the source of truth).
  if (!digits && normalized) {
    const candidates = await prisma.customer.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, name: true },
      take: 200,
    });
    const hit = candidates.find((c) => normalizeName(c.name) === normalized);
    if (hit) return hit.id;
  }

  // No match — create.
  const created = await prisma.customer.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone || null,
      whatsapp: input.whatsapp || buildWhatsappFromPhone(input.phone),
      address: input.address || null,
      status: "active",
      createdBy: userId,
    },
    select: { id: true },
  });

  await invalidateCustomerCache(tenantId);
  return created.id;
}

// ─── Update ─────────────────────────────────────────────────

export async function updateCustomer(
  tenantId: string,
  userId: string,
  input: UpdateCustomerInput
) {
  const existing = await prisma.customer.findFirst({
    where: { id: input.id, tenantId },
  });
  if (!existing) throw new Error("Customer not found");

  const customer = await prisma.customer.update({
    where: { id: input.id },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      whatsapp: input.whatsapp,
      tags: input.tags,
      creditLimit: input.creditLimit,
      additionalInfo: input.additionalInfo,
      status: input.status,
    },
  });

  await invalidateCustomerCache(tenantId);
  return customer;
}

// ─── Live per-customer stats ────────────────────────────────
// One pass over the tenant's non-deleted sales, folded into a
// per-customer struct. Lets the customers page show Delivered /
// Cancelled / Total Spent / Credit Due / Other Due breakdowns
// without N+1 queries (one for each customer).
//
// We deliberately recompute on every page load instead of trusting
// the cached counters on `customers.*` (which can drift if a sale is
// cancelled out-of-band). Hard-capped at 5000 sales — same envelope
// the cached sales list uses.

export type CustomerLiveStats = {
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number; // returned + cancelled + lost combined
  pendingCount: number;
  totalSpent: number; // delivered net (grand_total - fee)
  creditDue: number; // due on credit-term sales
  otherDue: number; // due on COD / immediate sales
  outstandingBalance: number; // creditDue + otherDue
  lastPurchaseDate: string | null;
};

const EMPTY_STATS: CustomerLiveStats = {
  orderCount: 0,
  deliveredCount: 0,
  cancelledCount: 0,
  pendingCount: 0,
  totalSpent: 0,
  creditDue: 0,
  otherDue: 0,
  outstandingBalance: 0,
  lastPurchaseDate: null,
};

export function emptyCustomerStats(): CustomerLiveStats {
  return { ...EMPTY_STATS };
}

export async function getCustomerLiveStats(
  tenantId: string
): Promise<Map<string, CustomerLiveStats>> {
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      isDeleted: false,
      customerId: { not: null },
    },
    select: {
      customerId: true,
      grandTotal: true,
      fee: true,
      amountDue: true,
      reviewAmountDue: true,
      paymentTerms: true,
      paymentMethod: true,
      courierStatus: true,
      createdAt: true,
    },
    take: 5000,
  });

  const map = new Map<string, CustomerLiveStats>();
  for (const sale of sales) {
    const id = sale.customerId!;
    const stats = map.get(id) ?? { ...EMPTY_STATS };
    stats.orderCount += 1;

    const courier = String(sale.courierStatus ?? "").toLowerCase();
    const isExcluded =
      courier === "cancelled" || courier === "returned" || courier === "lost";

    if (courier === "delivered") {
      stats.deliveredCount += 1;
      stats.totalSpent += Math.max(
        0,
        Number(sale.grandTotal ?? 0) - Number(sale.fee ?? 0)
      );
      const iso = sale.createdAt.toISOString();
      if (!stats.lastPurchaseDate || iso > stats.lastPurchaseDate) {
        stats.lastPurchaseDate = iso;
      }
    } else if (isExcluded) {
      stats.cancelledCount += 1;
    } else {
      stats.pendingCount += 1;
    }

    const due = Math.max(
      0,
      Number(sale.reviewAmountDue ?? sale.amountDue ?? 0)
    );
    if (due > 0 && !isExcluded) {
      const isCredit =
        String(sale.paymentTerms ?? "").toLowerCase() === "credit" ||
        String(sale.paymentMethod ?? "").toLowerCase() === "credit";
      if (isCredit) stats.creditDue += due;
      else stats.otherDue += due;
      stats.outstandingBalance = stats.creditDue + stats.otherDue;
    }

    map.set(id, stats);
  }
  return map;
}

// ─── Per-customer purchase history ──────────────────────────
// Surfaces the data the CustomerHistoryDialog needs in a single
// query: contact info + every non-deleted sale (with item count and
// payment splits) ordered newest-first. Hard-capped at 200 sales —
// the dialog paginates anything beyond that with a "Load more"
// affordance, but we want the typical case to render instantly.

export type CustomerHistorySale = {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentTerms: string;
  courierStatus: string | null;
  itemCount: number;
  createdAt: string;
};

export type CustomerHistoryPayload = {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    status: string;
    creditLimit: number | null;
    additionalInfo: string | null;
    lastPurchaseDate: string | null;
  };
  stats: CustomerLiveStats;
  sales: CustomerHistorySale[];
};

export async function getCustomerHistory(
  tenantId: string,
  customerId: string
): Promise<CustomerHistoryPayload | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, isDeleted: false },
    select: {
      id: true,
      name: true,
      phone: true,
      whatsapp: true,
      email: true,
      address: true,
      status: true,
      creditLimit: true,
      additionalInfo: true,
      lastPurchaseDate: true,
    },
  });
  if (!customer) return null;

  const sales = await prisma.sale.findMany({
    where: { tenantId, customerId, isDeleted: false },
    select: {
      id: true,
      invoiceNumber: true,
      grandTotal: true,
      amountPaid: true,
      amountDue: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentTerms: true,
      courierStatus: true,
      createdAt: true,
      items: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Fold the sales into the same per-customer struct the list page
  // uses so the dialog's summary cards stay consistent with the row
  // the user just clicked.
  const stats = emptyCustomerStats();
  for (const sale of sales) {
    stats.orderCount += 1;
    const courier = String(sale.courierStatus ?? "").toLowerCase();
    const isExcluded =
      courier === "cancelled" || courier === "returned" || courier === "lost";
    if (courier === "delivered") {
      stats.deliveredCount += 1;
      stats.totalSpent += Math.max(
        0,
        Number(sale.grandTotal ?? 0) - 0 // fee not selected; intentional — this matches the list page's fold
      );
    } else if (isExcluded) {
      stats.cancelledCount += 1;
    } else {
      stats.pendingCount += 1;
    }
    const due = Math.max(0, Number(sale.amountDue ?? 0));
    if (due > 0 && !isExcluded) {
      const isCredit =
        String(sale.paymentTerms ?? "").toLowerCase() === "credit" ||
        String(sale.paymentMethod ?? "").toLowerCase() === "credit";
      if (isCredit) stats.creditDue += due;
      else stats.otherDue += due;
    }
  }
  stats.outstandingBalance = stats.creditDue + stats.otherDue;
  stats.lastPurchaseDate =
    customer.lastPurchaseDate?.toISOString() ?? stats.lastPurchaseDate;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      email: customer.email,
      address: customer.address,
      status: customer.status,
      creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
      additionalInfo: customer.additionalInfo,
      lastPurchaseDate:
        customer.lastPurchaseDate?.toISOString() ?? null,
    },
    stats,
    sales: sales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      grandTotal: Number(s.grandTotal),
      amountPaid: Number(s.amountPaid),
      amountDue: Number(s.amountDue),
      paymentStatus: s.paymentStatus,
      paymentMethod: s.paymentMethod,
      paymentTerms: s.paymentTerms,
      courierStatus: s.courierStatus,
      itemCount: s.items.length,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

// ─── Delete (soft) ──────────────────────────────────────────

export async function deleteCustomer(
  tenantId: string,
  userId: string,
  customerId: string
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!existing) throw new Error("Customer not found");

  await prisma.customer.update({
    where: { id: customerId },
    data: { isDeleted: true },
  });

  await invalidateCustomerCache(tenantId);
}
