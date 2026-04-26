import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { POSSaleForm } from "./_components/pos-sale-form";
import { getNewSaleFormData } from "../actions";

// Routed through getNewSaleFormData (the same fetcher the New Sale
// dialog uses) so variants + enriched payment-method metadata flow
// through both entry points without duplicating the mapping logic.
export default async function NewSalePage() {
  const data = await getNewSaleFormData();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sales">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <POSSaleForm
        products={data.products}
        customers={data.customers}
        paymentMethods={data.paymentMethods}
      />
    </div>
  );
}
