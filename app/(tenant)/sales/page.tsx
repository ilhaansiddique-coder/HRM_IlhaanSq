import { requireTenant } from "@/lib/auth";
import { getCachedSales } from "@/lib/cache";
import { getAllTenantsSales } from "@/lib/services/sale.service";
import { SalesList, type SerializedSaleRow } from "./_components/sales-list";

export default async function SalesPage() {
  const session = await requireTenant();

  // Super admin: cross-tenant sales (each row tagged with tenant name).
  // Tenant user: their own tenant's cached sales only.
  const sales = session.isSuperAdmin
    ? await getAllTenantsSales()
    : await getCachedSales(session.tenantId);

  const serialized: SerializedSaleRow[] = sales.map((s) => {
    // Cross-tenant payload includes the tenant relation; tenant-scoped
    // reads do not. Read it defensively so both paths typecheck.
    const tenantName =
      "tenant" in s && s.tenant && typeof s.tenant === "object"
        ? (s.tenant as { name: string }).name
        : null;

    return {
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      grandTotal: Number(s.grandTotal ?? 0),
      amountPaid: Number(s.amountPaid ?? 0),
      amountDue: Number(s.amountDue ?? 0),
      paymentStatus: s.paymentStatus,
      paymentMethod: s.paymentMethod ?? "Cash",
      paymentTerms: s.paymentTerms ?? "immediate",
      courierStatus: s.courierStatus ?? null,
      courierName: s.courierName ?? null,
      cnNumber: s.cnNumber ?? null,
      dueDate: s.dueDate
        ? (s.dueDate instanceof Date
            ? s.dueDate
            : new Date(s.dueDate as unknown as string)
          ).toISOString()
        : null,
      createdAt: (s.createdAt instanceof Date
        ? s.createdAt
        : new Date(s.createdAt as unknown as string)
      ).toISOString(),
      createdById: s.creator?.id ?? null,
      createdByName: s.creator?.fullName ?? null,
      itemCount: s.items.length,
      payments: (s.payments ?? []).map((p) => ({
        method: p.method,
        amount: Number(p.amount ?? 0),
      })),
      tenantId: s.tenantId,
      tenantName,
    };
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <SalesList
        initialSales={serialized}
        showTenantColumn={session.isSuperAdmin}
      />
    </div>
  );
}
