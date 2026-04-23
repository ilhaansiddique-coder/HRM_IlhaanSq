"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Package, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrency } from "../../_components/providers";
import { deleteProductAction, duplicateProductAction } from "../actions";
import type { SerializedProduct } from "./product-list";

type Props = {
  product: SerializedProduct;
  onEdit: (product: SerializedProduct) => void;
};

type Status = "In Stock" | "Low Stock" | "Stock Out";

function statusOf(product: SerializedProduct): Status {
  if (product.totalStock <= 0) return "Stock Out";
  if (product.totalStock <= product.lowStockThreshold) return "Low Stock";
  return "In Stock";
}

function variantLabel(attributes: Record<string, string>): string {
  const values = Object.values(attributes);
  return values[0] ?? "Variant";
}

export function ProductCard({ product, onEdit }: Props) {
  const { formatAmount } = useCurrency();
  const [expanded, setExpanded] = useState(false);
  const status = statusOf(product);
  const variants = product.variants;
  const shown = expanded ? variants : variants.slice(0, 4);
  const attrKey =
    product.hasVariants && variants.length > 0
      ? Object.keys(variants[0].attributes)[0] ?? "Variant"
      : "";

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative">
        <div className="aspect-[3/2] w-full overflow-hidden bg-muted">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="absolute right-2 top-2">
          <Badge
            variant={
              status === "In Stock"
                ? "default"
                : status === "Low Stock"
                  ? "secondary"
                  : "destructive"
            }
            className="shadow-sm"
          >
            {status}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="mb-2">
          <h3 className="line-clamp-2 text-base font-semibold leading-tight">
            {product.name}
          </h3>
          {product.sku && (
            <p className="truncate text-xs text-muted-foreground">{product.sku}</p>
          )}
        </div>

        {product.hasVariants && variants.length > 0 ? (
          <div className="mb-2 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{attrKey}</span>
              <span>Stock</span>
            </div>
            <div className="space-y-0.5">
              {shown.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded bg-muted/40 px-1.5 py-0.5 text-sm"
                >
                  <span className="mr-1 flex-1 truncate">
                    {variantLabel(v.attributes)}
                  </span>
                  <span
                    className={`font-medium ${
                      v.stockQuantity <= 0 ? "text-destructive" : ""
                    }`}
                  >
                    {v.stockQuantity}
                  </span>
                </div>
              ))}
            </div>
            {variants.length > 4 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex w-full items-center justify-center gap-0.5 pt-0.5 text-xs font-medium text-primary hover:text-primary/80"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />+{variants.length - 4}
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          (product.size || product.color) && (
            <div className="mb-2 flex flex-wrap gap-1">
              {product.size && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {product.size}
                </span>
              )}
              {product.color && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {product.color}
                </span>
              )}
            </div>
          )
        )}

        <div className="flex-1" />

        <div className="mt-2 space-y-1.5 border-t pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-lg font-bold text-primary">
              {formatAmount(product.rate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Items</span>
            <span className="text-sm font-semibold">{product.totalStock}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Value</span>
            <span className="text-sm font-semibold text-primary">
              {formatAmount(product.totalValue)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex gap-1.5 border-t pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 flex-1"
            onClick={() => onEdit(product)}
            aria-label="Edit product"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <form action={duplicateProductAction} className="flex-1">
            <input type="hidden" name="productId" value={product.id} />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="h-8 w-full"
              aria-label="Duplicate product"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </form>
          <form action={deleteProductAction} className="flex-1">
            <input type="hidden" name="productId" value={product.id} />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="h-8 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete product"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
