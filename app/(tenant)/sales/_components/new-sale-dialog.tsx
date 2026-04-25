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
import { POSSaleForm } from "../new/_components/pos-sale-form";
import { getNewSaleFormData } from "../actions";

type FormData = Awaited<ReturnType<typeof getNewSaleFormData>>;

export function NewSaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load form data the first time the dialog is opened. Subsequent
  // opens reuse the cached data — products/customers/payment methods
  // rarely change inside one session.
  useEffect(() => {
    if (!open || data || loading) return;
    setLoading(true);
    setError(null);
    getNewSaleFormData()
      .then((d) => setData(d))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load form data")
      )
      .finally(() => setLoading(false));
  }, [open, data, loading]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Sale</DialogTitle>
          <DialogDescription>
            Add products, choose a customer, and pick how it&apos;ll be paid.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : loading || !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <POSSaleForm
            products={data.products}
            customers={data.customers}
            paymentMethods={data.paymentMethods}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
