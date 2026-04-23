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
    paymentStatus: s.paymentStatus,
    courierStatus: s.courierStatus ?? null,
    createdAt: (s.createdAt instanceof Date
      ? s.createdAt
      : new Date(s.createdAt as unknown as string)
    ).toISOString(),
    itemCount: s.items.length,
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      <SalesList initialSales={serialized} />
    </div>
  );
}
