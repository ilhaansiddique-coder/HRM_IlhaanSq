import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getCachedProducts, getCachedCustomers, getCachedPaymentMethods } from "@/lib/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { POSSaleForm } from "./_components/pos-sale-form";

export default async function NewSalePage() {
  const session = await requireTenant();
  const [products, customers, paymentMethods] = await Promise.all([
    getCachedProducts(session.tenantId),
    getCachedCustomers(session.tenantId),
    getCachedPaymentMethods(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sales"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      <POSSaleForm
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          rate: Number(p.rate),
          stockQuantity: p.stockQuantity,
        }))}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          whatsapp: c.whatsapp,
        }))}
        paymentMethods={paymentMethods.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
