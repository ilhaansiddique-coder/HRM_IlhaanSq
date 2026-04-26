"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  adjustStockAction,
  getProductPickerOptions,
} from "../actions";

type PickerProduct = {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  tenantName: string | null;
};

type AdjustmentType = "in" | "out" | "adjustment";

const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  in: "Stock In (+)",
  out: "Stock Out (-)",
  adjustment: "Adjustment",
};

export function AdjustStockDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<AdjustmentType>("in");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  // Fetch the picker list when the dialog opens (and only once).
  useEffect(() => {
    if (!open || products.length > 0) return;
    let cancelled = false;
    getProductPickerOptions()
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load products");
      });
    return () => {
      cancelled = true;
    };
  }, [open, products.length]);

  function reset() {
    setProductId("");
    setType("in");
    setQuantity("");
    setReason("");
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function handleSubmit() {
    if (!productId) {
      toast.error("Select a product first");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be a positive number");
      return;
    }

    const fd = new window.FormData();
    fd.set("productId", productId);
    fd.set("type", type);
    fd.set("quantity", String(qty));
    if (reason.trim()) fd.set("reason", reason.trim());

    startTransition(async () => {
      try {
        await adjustStockAction(fd);
        toast.success("Stock adjusted");
        handleOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to adjust stock");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Adjust Stock
          </DialogTitle>
          <DialogDescription className="sr-only">
            Increase or decrease stock for the selected product with an
            optional reason for the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Loading…
                  </div>
                ) : (
                  products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.sku}
                        </span>
                      ) : null}
                      {p.tenantName ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {p.tenantName}
                        </span>
                      ) : null}
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {p.stockQuantity} in stock
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as AdjustmentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentType[]).map(
                  (t) => (
                    <SelectItem key={t} value={t}>
                      {ADJUSTMENT_LABELS[t]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for adjustment (optional)"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !productId || !quantity}
          >
            {pending ? "Adjusting…" : "Adjust Stock"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
