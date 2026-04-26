import { requireTenant } from "@/lib/auth";
import { getCachedCustomers } from "@/lib/cache";
import {
  emptyCustomerStats,
  getAllTenantsCustomers,
  getCustomerLiveStats,
} from "@/lib/services/customer.service";
import { getOverdueCreditSales } from "@/lib/services/customer-payment.service";
import { CustomerList, type SerializedCustomerRow } from "./_components/customer-list";
import { OverdueCreditAlert } from "./_components/overdue-credit-alert";

export default async function CustomersPage() {
  const session = await requireTenant();

  // Super admin: cross-tenant customers (each row tagged with tenant name).
  // Tenant user: their own tenant's cached customers only.
  const customers = session.isSuperAdmin
    ? await getAllTenantsCustomers()
    : await getCachedCustomers(session.tenantId);

  // One pass over the tenant's sales to fold per-customer stats —
  // delivered/cancelled counts, total spent, credit due, other due.
  // Replaces the earlier creditDue-only groupBy. Skipped for super
  // admin (would need a per-tenant fan-out and the cross-tenant view
  // doesn't surface these breakdowns anyway).
  const liveStats = session.isSuperAdmin
    ? new Map<string, ReturnType<typeof emptyCustomerStats>>()
    : await getCustomerLiveStats(session.tenantId);
  const overdue = session.isSuperAdmin
    ? []
    : await getOverdueCreditSales(session.tenantId);

  const serialized: SerializedCustomerRow[] = customers.map((c) => {
    const tenantName =
      "tenant" in c && c.tenant && typeof c.tenant === "object"
        ? (c.tenant as { name: string }).name
        : null;

    const stats = liveStats.get(c.id) ?? emptyCustomerStats();

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      whatsapp: c.whatsapp,
      status: c.status,
      // Live-computed counters take precedence over the cached
      // counters on the customer row. The cached `orderCount` /
      // `totalSpent` columns can drift if a sale is cancelled
      // out-of-band; the recomputed numbers always match the sales
      // table.
      orderCount: stats.orderCount || c.orderCount,
      deliveredCount: stats.deliveredCount,
      cancelledCount: stats.cancelledCount,
      pendingCount: stats.pendingCount,
      totalSpent: stats.totalSpent || Number(c.totalSpent ?? 0),
      creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
      creditDue: stats.creditDue,
      otherDue: stats.otherDue,
      outstandingBalance: stats.outstandingBalance,
      additionalInfo: c.additionalInfo,
      createdAt: (c.createdAt instanceof Date
        ? c.createdAt
        : new Date(c.createdAt as unknown as string)
      ).toISOString(),
      tenantId: c.tenantId,
      tenantName,
    };
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {!session.isSuperAdmin && overdue.length > 0 && (
        <OverdueCreditAlert rows={overdue} />
      )}
      <CustomerList
        initialCustomers={serialized}
        showTenantColumn={session.isSuperAdmin}
        readOnly={session.isSuperAdmin}
      />
    </div>
  );
}
