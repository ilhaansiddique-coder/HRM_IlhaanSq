"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Copy,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";

type ActivityEntry = {
  id: string;
  action: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  details: Record<string, unknown> | null;
};

type ActivityResponse = {
  createdAt: string | null;
  lastUpdatedAt: string | null;
  updateCount: number;
  entries: ActivityEntry[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "Not available";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionIcon(action: string) {
  switch (action) {
    case "create":
      return <Plus className="h-3.5 w-3.5" />;
    case "update":
      return <Pencil className="h-3.5 w-3.5" />;
    case "delete":
      return <Trash2 className="h-3.5 w-3.5" />;
    case "duplicate":
      return <Copy className="h-3.5 w-3.5" />;
    default:
      return <RefreshCcw className="h-3.5 w-3.5" />;
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case "create":
      return "Created";
    case "update":
      return "Updated";
    case "delete":
      return "Deleted";
    case "duplicate":
      return "Duplicated";
    default:
      return action;
  }
}

export function ActivityTab({ productId, active }: { productId: string; active: boolean }) {
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["product-activity", productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/activity`);
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status})`);
      return res.json() as Promise<ActivityResponse>;
    },
    enabled: active && !!productId,
  });

  const queryError = error instanceof Error ? error.message : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Plus className="h-4 w-4 text-sky-400" />}
          label="Created"
          value={loading ? "…" : formatDate(data?.createdAt ?? null)}
          tone="sky"
        />
        <StatCard
          icon={<RefreshCcw className="h-4 w-4 text-amber-400" />}
          label="Last Updated"
          value={
            loading
              ? "…"
              : data?.lastUpdatedAt
                ? formatDate(data.lastUpdatedAt)
                : "No updates yet"
          }
          tone="amber"
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4 text-emerald-400" />}
          label="Update Count"
          value={loading ? "…" : String(data?.updateCount ?? 0)}
          tone="emerald"
        />
      </div>

      {queryError ? (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {queryError}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity…
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-muted-foreground">
          <Inbox className="h-6 w-6 opacity-60" />
          <div className="text-sm font-medium">No activity yet</div>
          <div className="text-xs">Activity will appear here once actions are performed</div>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                {actionIcon(e.action)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{actionLabel(e.action)}</span>
                  <span className="text-muted-foreground">by</span>
                  <span className="truncate">{e.userName}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(e.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "sky" | "amber" | "emerald";
}) {
  const valueClass =
    tone === "sky"
      ? "text-sky-400"
      : tone === "amber"
        ? "text-amber-400"
        : "text-emerald-400";
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
