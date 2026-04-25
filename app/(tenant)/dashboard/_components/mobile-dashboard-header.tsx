"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Plus, ShoppingCart, Users } from "lucide-react";
import { DateRangePicker } from "./date-range-picker";
import { NewSaleDialog } from "../../_components/new-sale-dialog";
import { ProductDialog } from "../../products/_components/product-dialog";

// Mobile-only dashboard header. Matches the layout the user supplied:
//   ┌──────────────────────────────────┐
//   │ Dashboard           [📅 Today ]  │
//   │ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │
//   │ │🛒│ │ +│ │📊│ │👥│              │
//   │ Sale Product Reports Customers   │
//   └──────────────────────────────────┘
// Wrapped in `md:hidden` so desktop keeps the existing TopBar layout.
// The TopBar's own date picker is hidden on mobile so we don't show
// the same control twice.
export function MobileDashboardHeader() {
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);

  return (
    <div className="md:hidden space-y-3">
      {/* Title + Today picker */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <DateRangePicker />
      </div>

      {/* 4-card quick-action row */}
      <div className="grid grid-cols-4 gap-2">
        <ActionCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Sale"
          onClick={() => setNewSaleOpen(true)}
        />
        <ActionCard
          icon={<Plus className="h-4 w-4" />}
          label="Product"
          onClick={() => setAddProductOpen(true)}
        />
        <ActionCardLink
          icon={<BarChart3 className="h-4 w-4" />}
          label="Reports"
          href="/reports"
        />
        <ActionCardLink
          icon={<Users className="h-4 w-4" />}
          label="Customers"
          href="/customers"
        />
      </div>

      {/* Dialogs — own state instances so they don't share with TopBar.
          Both are controlled (open/onOpenChange) so this is safe. */}
      <NewSaleDialog open={newSaleOpen} onOpenChange={setNewSaleOpen} />
      <ProductDialog
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
      />
    </div>
  );
}

function cardClasses() {
  return "flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-3 text-foreground transition-colors active:bg-muted/40 hover:bg-muted/30";
}

function ActionCard({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cardClasses()}>
      <span className="text-foreground">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ActionCardLink({
  icon,
  label,
  href,
}: {
  icon: ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link href={href} className={cardClasses()}>
      <span className="text-foreground">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
