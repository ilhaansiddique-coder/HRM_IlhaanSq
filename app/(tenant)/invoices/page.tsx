import { requireTenant } from "@/lib/auth";
import { getCachedSales } from "@/lib/cache";
import { getAllTenantsSales } from "@/lib/services/sale.service";
import { InvoiceList, type SerializedInvoiceRow } from "./_components/invoice-list";
import { PageErrorState } from "../_components/page-error-state";

export default async function InvoicesPage() {
  const session = await requireTenant();

  // Wrap fetch + serialization so a failed query renders the inline
  // error fallback instead of bubbling to the framework 500. See
  // PageErrorState — production strips error.message before it
  // reaches a client error boundary, so this is the only way to
  // surface the actual cause to the user.
  let serialized: SerializedInvoiceRow[];
  let thisMonthRevenue: number;
  try {
    // Super admin: cross-tenant invoices (each row tagged with the
    // owning tenant's name). Tenant user: their own tenant's cached
    // invoices only. Mirrors the same pattern used for /sales and
    // /customers — `getAllTenantsSales` is uncached + includes the
    // tenant relation, hard-capped at 500 rows per the service.
    const sales = session.isSuperAdmin
      ? await getAllTenantsSales()
      : await getCachedSales(session.tenantId);

    serialized = sales.map((s) => {
      const created = s.createdAt instanceof Date
        ? s.createdAt
        : new Date(s.createdAt as unknown as string);
      const due = s.dueDate
        ? (s.dueDate instanceof Date ? s.dueDate : new Date(s.dueDate as unknown as string))
        : null;
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
        createdAt: created.toISOString(),
        dueDate: due ? due.toISOString() : null,
        tenantId: s.tenantId,
        tenantName,
      };
    });

    // "This Month" KPI is computed off the FULL list (not the filtered
    // view) so it remains a useful at-a-glance metric regardless of
    // whatever date filter the user has applied. Excludes cancelled.
    // For super admin this aggregates across every tenant.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    thisMonthRevenue = sales.reduce((sum, s) => {
      if (s.paymentStatus === "cancelled") return sum;
      const created = s.createdAt instanceof Date
        ? s.createdAt
        : new Date(s.createdAt as unknown as string);
      if (created >= monthStart && created <= now) {
        return sum + Number(s.grandTotal ?? 0);
      }
      return sum;
    }, 0);
  } catch (e) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageErrorState title="Invoices" error={e} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <InvoiceList
        initialSales={serialized}
        thisMonthRevenue={thisMonthRevenue}
        showTenantColumn={session.isSuperAdmin}
      />
    </div>
  );
}
