"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import type { TopProductItem } from "@/lib/services/dashboard-analytics.service";
import { useCurrency } from "../../_components/providers";

export function TopProductsList({ items }: { items: TopProductItem[] }) {
  const { formatAmount } = useCurrency();

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Top Products</h3>
        <Link href="/products" className="text-xs text-primary hover:underline">
          See All
        </Link>
      </div>

      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              No product sales yet this month
            </p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="w-5 text-xs font-medium text-muted-foreground">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="relative h-9 w-9 overflow-hidden rounded-md bg-muted shrink-0">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.name}</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-xs tabular-nums">
                <div className="font-semibold">{formatAmount(item.revenue)}</div>
                <div className="text-muted-foreground">{item.percent}%</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
