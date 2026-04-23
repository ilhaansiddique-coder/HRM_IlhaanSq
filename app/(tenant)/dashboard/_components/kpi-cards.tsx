"use client";

import {
  Building2,
  DollarSign,
  Package,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import type {
  KpiCards as KpiData,
  PlatformCounters,
} from "@/lib/services/dashboard-analytics.service";
import { useCurrency } from "../../_components/providers";

type Variant = "pink" | "cyan" | "orange" | "green" | "indigo";

const TONES: Record<
  Variant,
  { bg: string; chip: string; icon: string; label: string }
> = {
  pink: {
    bg: "bg-[#FCEEF2] dark:bg-[#3a1f29]",
    chip: "bg-[#F8BAD2] dark:bg-[#6b2e44]",
    icon: "text-[#E94E77] dark:text-[#f38fae]",
    label: "text-[#6b2e44] dark:text-[#f8bad2]",
  },
  cyan: {
    bg: "bg-[#E6F4F9] dark:bg-[#1a2e38]",
    chip: "bg-[#B4DCEC] dark:bg-[#2a556b]",
    icon: "text-[#1A8DB5] dark:text-[#7ec5de]",
    label: "text-[#0f4a5e] dark:text-[#b4dcec]",
  },
  orange: {
    bg: "bg-[#FFF3E6] dark:bg-[#3a2a1a]",
    chip: "bg-[#FFD4A3] dark:bg-[#6b4725]",
    icon: "text-[#F28C2E] dark:text-[#f5b975]",
    label: "text-[#6b4725] dark:text-[#ffd4a3]",
  },
  green: {
    bg: "bg-[#E8F5EE] dark:bg-[#1f3a2a]",
    chip: "bg-[#B6E6CB] dark:bg-[#2f6b47]",
    icon: "text-[#2AA765] dark:text-[#7fd5a3]",
    label: "text-[#1f5438] dark:text-[#b6e6cb]",
  },
  indigo: {
    bg: "bg-[#ECEBFB] dark:bg-[#24223e]",
    chip: "bg-[#C7C3F2] dark:bg-[#453f80]",
    icon: "text-[#6B63E6] dark:text-[#a7a1f3]",
    label: "text-[#3b357e] dark:text-[#c7c3f2]",
  },
};

export function KpiCardsRow({
  kpi,
  platformMetrics,
}: {
  kpi: KpiData;
  platformMetrics?: PlatformCounters;
}) {
  const { formatAmount } = useCurrency();
  const hasTenantCard = !!platformMetrics;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <h3 className="text-sm font-semibold tracking-tight mb-3">
        Today&apos;s Sales
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Sales Summary</p>
      <div
        className={`grid grid-cols-2 gap-3 ${
          hasTenantCard
            ? "md:grid-cols-3 xl:grid-cols-5"
            : "md:grid-cols-4"
        }`}
      >
        <KpiTile
          variant="pink"
          icon={<DollarSign className="h-4 w-4" />}
          value={formatAmount(kpi.revenueToday)}
          label="Total Sales"
          changePct={kpi.revenueChangePct}
        />
        {platformMetrics && (
          <KpiTile
            variant="cyan"
            icon={<Building2 className="h-4 w-4" />}
            value={platformMetrics.totalTenants.toLocaleString()}
            label="Total Tenants"
            footer={
              platformMetrics.pendingRequests > 0
                ? `${platformMetrics.pendingRequests} pending request${
                    platformMetrics.pendingRequests !== 1 ? "s" : ""
                  }`
                : "All tenants active"
            }
            footerTone={
              platformMetrics.pendingRequests > 0 ? "warn" : "neutral"
            }
          />
        )}
        <KpiTile
          variant="orange"
          icon={<ShoppingBag className="h-4 w-4" />}
          value={kpi.ordersToday.toLocaleString()}
          label="Total Order"
          changePct={kpi.ordersChangePct}
        />
        <KpiTile
          variant="green"
          icon={<Package className="h-4 w-4" />}
          value={kpi.productsSoldToday.toLocaleString()}
          label="Product Sold"
          changePct={kpi.productsSoldChangePct}
        />
        <KpiTile
          variant="indigo"
          icon={<UserPlus className="h-4 w-4" />}
          value={kpi.newCustomersToday.toLocaleString()}
          label="New Customers"
          changePct={kpi.newCustomersChangePct}
        />
      </div>
    </div>
  );
}

function KpiTile({
  variant,
  icon,
  value,
  label,
  changePct,
  footer,
  footerTone,
}: {
  variant: Variant;
  icon: React.ReactNode;
  value: string;
  label: string;
  changePct?: number;
  footer?: string;
  footerTone?: "up" | "down" | "warn" | "neutral";
}) {
  const tone = TONES[variant];

  // Resolve the footer line: explicit `footer` prop wins, otherwise
  // fall back to the "+X% from yesterday" format from `changePct`.
  let footerText = footer;
  let resolvedTone: "up" | "down" | "warn" | "neutral" =
    footerTone ?? "neutral";
  if (!footerText && typeof changePct === "number") {
    const up = changePct >= 0;
    footerText = `${up ? "+" : ""}${changePct}% from yesterday`;
    resolvedTone = up ? "up" : "down";
  }

  const footerClass =
    resolvedTone === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : resolvedTone === "down"
        ? "text-rose-600 dark:text-rose-400"
        : resolvedTone === "warn"
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground";

  return (
    <div className={`rounded-xl p-4 ${tone.bg}`}>
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tone.chip} ${tone.icon}`}
      >
        {icon}
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <div className={`mt-1 text-xs font-medium ${tone.label}`}>{label}</div>
      {footerText && (
        <div className={`mt-2 text-[11px] ${footerClass}`}>{footerText}</div>
      )}
    </div>
  );
}
