import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * KPI / summary metric card — matches the dashboard tile style:
 * a small muted label top-left, a tinted rounded-square icon top-right,
 * a large value, and an optional muted subtitle underneath.
 *
 * Theme-aware: all colours resolve from design tokens so the tile adapts
 * to both the light and night themes.
 */

export type StatTone =
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "info";

const TONE_ICON: Record<StatTone, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: StatTone;
  href?: string;
  className?: string;
  valueClassName?: string;
}

export function StatCard({
  label,
  value,
  icon,
  subtitle,
  tone = "primary",
  href,
  className,
  valueClassName,
}: StatCardProps) {
  const card = (
    <div
      className={cn(
        "rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm transition-colors",
        href && "hover:bg-base-200/50",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&_svg]:h-4 [&_svg]:w-4",
              TONE_ICON[tone]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className={cn("mt-3 text-3xl font-bold tracking-tight", valueClassName)}>
        {value}
      </p>
      {subtitle != null && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}
