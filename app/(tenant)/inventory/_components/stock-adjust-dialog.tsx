"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowUp, ArrowDown, Equal } from "lucide-react";
import { adjustStockAction } from "../../products/actions";

export function StockAdjustDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; stockQuantity: number } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"in" | "out" | "adjustment">("in");

  function handleSubmit(formData: FormData) {
    if (!product) return;
    setError(null);
    formData.set("productId", product.id);
    formData.set("type", type);
    startTransition(async () => {
      try {
        await adjustStockAction(formData);
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {product?.name} — current stock: <strong>{product?.stockQuantity}</strong>
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "in", label: "Stock In", icon: <ArrowUp className="h-4 w-4" /> },
              { v: "out", label: "Stock Out", icon: <ArrowDown className="h-4 w-4" /> },
              { v: "adjustment", label: "Adjust", icon: <Equal className="h-4 w-4" /> },
            ] as const).map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setType(t.v)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors ${
                  type === t.v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-background/40 hover:bg-background/60"
                }`}
              >
                {t.icon}
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input id="quantity" name="quantity" type="number" min="1" required defaultValue="1" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" name="reason" rows={2} placeholder="e.g., supplier delivery, damaged stock, recount..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
