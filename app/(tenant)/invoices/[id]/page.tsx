import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { tenantDb } from "@/lib/db";
import { getCachedBusinessSettings, getCachedSystemSettings } from "@/lib/cache";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { InvoiceView } from "./_components/invoice-view";
import {
  toInvoiceBusiness,
  toInvoiceSale,
  toInvoiceSystem,
} from "@/lib/invoice/types";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireTenant();
  const db = tenantDb(session.tenantId);

  const [sale, business, system] = await Promise.all([
    db.sale.findFirst({
      where: { id },
      include: {
        items: { include: { product: true, variant: true } },
        customer: true,
      },
    }),
    getCachedBusinessSettings(session.tenantId),
    getCachedSystemSettings(session.tenantId),
  ]);

  if (!sale) notFound();

  const invoiceSale = toInvoiceSale(sale);
  const invoiceBusiness = toInvoiceBusiness(business);
  const invoiceSystem = toInvoiceSystem(system);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>
      </div>

      <InvoiceView
        sale={invoiceSale}
        business={invoiceBusiness}
        system={invoiceSystem}
      />
    </div>
  );
}
