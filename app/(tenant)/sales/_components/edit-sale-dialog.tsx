"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { POSSaleForm, type POSSaleFormInitial } from "../new/_components/pos-sale-form";
import { getNewSaleFormData, getSaleAction } from "../actions";

type FormData = Awaited<ReturnType<typeof getNewSaleFormData>>;
type SalePayload = Awaited<ReturnType<typeof getSaleAction>>;

// Edit dialog: lazy-loads (a) form catalog data — products, customers,
// payment methods — and (b) the full sale record. Once both arrive,
// it shapes them into POSSaleFormInitial and renders POSSaleForm in
// edit mode. Submit posts to updateSaleAction (the form picks the
// action based on `mode`).
//
// Two important rules:
// 1. The variant id on each existing line item must round-trip back
//    out — otherwise editing a variant sale would silently drop the
//    variant. We carry it in `cart[i].variantId`.
// 2. `maxStock` for each cart row is computed against the LIVE
//    catalog stock + the original quantity that was decremented.
//    This way the cashier can keep the original qty even if the
//    catalog now shows zero left, but they can't go higher than the
//    sum of "current free + originally claimed".
export function EditSaleDialog({
  open,
  onOpenChange,
  saleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [sale, setSale] = useState<SalePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !saleId) return;
    setLoading(true);
    setError(null);
    setFormData(null);
    setSale(null);
    Promise.all([getNewSaleFormData(), getSaleAction(saleId)])
      .then(([d, s]) => {
        setFormData(d);
        setSale(s);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load sale")
      )
      .finally(() => setLoading(false));
  }, [open, saleId]);

  const initial: POSSaleFormInitial | null = (() => {
    if (!sale || !formData) return null;
    const productById = new Map(formData.products.map((p) => [p.id, p]));
    return {
      saleId: sale.id,
      saleDate: sale.createdAt.split("T")[0],
      cart: sale.items.map((it) => {
        const p = it.productId ? productById.get(it.productId) : undefined;
        const variant = it.variantId
          ? p?.variants?.find((v) => v.id === it.variantId)
          : null;
        // Original quantity is already decremented from catalog stock,
        // so the editable ceiling = live free stock + original qty.
        const liveFree = variant
          ? variant.stockQuantity
          : (p?.stockQuantity ?? 0);
        return {
          productId: it.productId ?? "",
          variantId: it.variantId ?? null,
          productName: it.productName,
          variantLabel: it.variantLabel,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          maxStock: liveFree + it.quantity,
        };
      }),
      // Use "existing" mode if the sale was tied to a customer the
      // form catalog still knows about; otherwise fall back to "new"
      // so the cashier can still tweak the snapshotted name/phone.
      customerMode: sale.customerId ? "existing" : "new",
      selectedCustomerId: sale.customerId ?? "",
      customerName: sale.customerName,
      customerPhone: sale.customerPhone ?? "",
      customerAddress: sale.customerAddress ?? "",
      customerWhatsapp: sale.customerWhatsapp ?? "",
      discountAmount: sale.discountAmount,
      charge: sale.charge || 0,
      paymentMethod: sale.paymentMethod,
      paymentTerms: (sale.paymentTerms as POSSaleFormInitial["paymentTerms"]) ?? "immediate",
      creditDays: sale.creditDays ?? 7,
      paymentSplits: sale.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
      notes: sale.additionalInfo ?? "",
    };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Sale {sale?.invoiceNumber ? `· ${sale.invoiceNumber}` : ""}
          </DialogTitle>
          <DialogDescription>
            Adjust items, totals, and payment. Stock will be re-balanced based
            on the difference between the original and the new quantities.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : loading || !formData || !initial ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <POSSaleForm
            mode="edit"
            initial={initial}
            products={formData.products}
            customers={formData.customers}
            paymentMethods={formData.paymentMethods}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
