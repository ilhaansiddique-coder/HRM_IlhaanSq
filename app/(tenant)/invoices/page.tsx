import { requireTenant } from "@/lib/auth";
import { getCachedSales } from "@/lib/cache";
import { InvoiceList, type SerializedInvoiceRow } from "./_components/invoice-list";

export default async function InvoicesPage() {
  const session = await requireTenant();
  const sales = await getCachedSales(session.tenantId);

  const serialized: SerializedInvoiceRow[] = sales.map((s) => ({
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    customerName: s.customerName,
    grandTotal: Number(s.grandTotal ?? 0),
    amountPaid: Number(s.amountPaid ?? 0),
    amountDue: Number(s.amountDue ?? 0),
    paymentStatus: s.paymentStatus,
    createdAt: (s.createdAt instanceof Date
      ? s.createdAt
      : new Date(s.createdAt as unknown as string)
    ).toISOString(),
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {serialized.length} invoice{serialized.length !== 1 ? "s" : ""}
        </p>
      </div>

      <InvoiceList initialSales={serialized} />
    </div>
  );
}
