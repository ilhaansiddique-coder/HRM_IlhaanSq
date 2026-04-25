import { requireTenant } from "@/lib/auth";
import { getCachedSales } from "@/lib/cache";
import { SalesList, type SerializedSaleRow } from "./_components/sales-list";

export default async function SalesPage() {
  const session = await requireTenant();
  const sales = await getCachedSales(session.tenantId);

  const serialized: SerializedSaleRow[] = sales.map((s) => ({
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
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      <SalesList initialSales={serialized} />
    </div>
  );
}
