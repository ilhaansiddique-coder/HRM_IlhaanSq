"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  TrendingUp,
  Users,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// Skeleton ported from src/views/Alerts.tsx (the Vite-tree reference page).
// The element hierarchy is identical:
//   - 4 KPI cards across the top
//   - 2-column grid below: Recent Alerts (left) + Alert Preferences (right)
// What's different in this Next.js port:
//   - All alert data is computed server-side via Prisma in page.tsx and
//     passed in as `initialAlerts`. No client-side hooks.
//   - Dismiss + preferences state lives in localStorage (same as the Vite
//     version did for preferences). The Vite version persisted dismissals
//     to a Supabase `dismissed_alerts` table, but we don't have that
//     table in this project — local dismiss is the lighter equivalent.

export type AlertCategory = "inventory" | "payment" | "customer" | "system";
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertIconKey =
  | "alert-triangle"
  | "package"
  | "info"
  | "trending-up"
  | "users"
  | "bell";

export type SerializedAlert = {
  id: string;
  type: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  time: string; // ISO string
  iconKey: AlertIconKey;
  actionable: boolean;
};

const ICON_MAP: Record<AlertIconKey, React.ComponentType<{ className?: string }>> = {
  "alert-triangle": AlertTriangle,
  package: Package,
  info: Info,
  "trending-up": TrendingUp,
  users: Users,
  bell: Bell,
};

const PREFS_KEY = "alertSettings";
const DISMISSED_KEY = "dismissedAlerts";

type Prefs = {
  lowStock: boolean;
  payments: boolean;
  customers: boolean;
  system: boolean;
  email: boolean;
};

const DEFAULT_PREFS: Prefs = {
  lowStock: true,
  payments: true,
  customers: false,
  system: true,
  email: false,
};

function getTimeAgo(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const hours = Math.floor((now - target) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function AlertsView({
  initialAlerts,
}: {
  initialAlerts: SerializedAlert[];
}) {
  // Persist preferences in localStorage — matches Vite parent's behavior.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawPrefs = localStorage.getItem(PREFS_KEY);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs) as Partial<Prefs>;
        setPrefs((p) => ({ ...p, ...parsed }));
      }
      const rawDismissed = localStorage.getItem(DISMISSED_KEY);
      if (rawDismissed) {
        const parsed = JSON.parse(rawDismissed);
        if (Array.isArray(parsed)) setDismissedIds(parsed);
      }
    } catch {
      // ignore corrupt local state
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore quota/private mode
    }
  }, [prefs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedIds));
    } catch {
      // ignore
    }
  }, [dismissedIds, hydrated]);

  // Apply pref filters + dismissed filter, sort critical → warning → info
  // then most-recent-first within each tier (mirrors Vite version).
  const allAlerts = useMemo(() => {
    const dismissedSet = new Set(dismissedIds);
    const priority = { critical: 3, warning: 2, info: 1 } as const;
    return initialAlerts
      .filter((a) => {
        if (dismissedSet.has(a.id)) return false;
        if (a.category === "inventory" && !prefs.lowStock) return false;
        if (a.category === "payment" && !prefs.payments) return false;
        if (a.category === "customer" && !prefs.customers) return false;
        if (a.category === "system" && !prefs.system) return false;
        return true;
      })
      .sort((a, b) => {
        const pa = priority[a.type];
        const pb = priority[b.type];
        if (pa !== pb) return pb - pa;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });
  }, [initialAlerts, dismissedIds, prefs]);

  const lowStockAlerts = allAlerts.filter(
    (a) => a.category === "inventory" && a.type === "warning"
  );
  const outOfStockAlerts = allAlerts.filter(
    (a) => a.category === "inventory" && a.type === "critical"
  );
  const paymentAlerts = allAlerts.filter((a) => a.category === "payment");

  function dismissAlert(id: string) {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function markAllRead() {
    if (allAlerts.length === 0) return;
    setDismissedIds((prev) => {
      const next = new Set(prev);
      for (const a of allAlerts) next.add(a.id);
      return [...next];
    });
  }

  function toggleSetting(key: keyof Prefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <div className="space-y-6">
      {/* ── Header action: Mark All Read ──
          Disabled when there are no active alerts. Shows a count badge
          beside the label so it's obvious how many will be dismissed —
          without that, the disabled vs enabled outline-button looks
          almost identical and the button feels broken. */}
      <div className="flex items-center justify-end pb-1">
        <Button
          variant="outline"
          onClick={markAllRead}
          disabled={allAlerts.length === 0}
          aria-label={
            allAlerts.length === 0
              ? "Nothing to mark — no active alerts"
              : `Mark all ${allAlerts.length} alerts as read`
          }
          title={
            allAlerts.length === 0
              ? "Nothing to mark — no active alerts"
              : `Dismiss all ${allAlerts.length} active alert${allAlerts.length === 1 ? "" : "s"}`
          }
          className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Mark All Read</span>
          {allAlerts.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0 text-[11px] font-semibold leading-tight text-primary-foreground">
              {allAlerts.length}
            </span>
          )}
        </Button>
      </div>

      {/* ── 4 KPI cards across the top ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              {allAlerts.filter((a) => a.type === "critical").length} critical alerts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {lowStockAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Alerts</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paymentAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              {paymentAlerts.filter((a) => a.type === "critical").length} critical,{" "}
              {paymentAlerts.filter((a) => a.type === "warning").length} warning
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {outOfStockAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">Urgent restocking</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 2-column grid: Recent Alerts (left) + Alert Preferences (right) ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {allAlerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                <p className="text-muted-foreground">No active alerts</p>
                <p className="text-sm text-muted-foreground">Everything looks good!</p>
              </div>
            ) : (
              allAlerts.slice(0, 10).map((alert) => {
                const Icon = ICON_MAP[alert.iconKey];
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Icon
                      className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                        alert.type === "critical"
                          ? "text-destructive"
                          : alert.type === "warning"
                            ? "text-warning"
                            : "text-info"
                      }`}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{alert.title}</p>
                        <Badge
                          variant={
                            alert.type === "critical"
                              ? "destructive"
                              : alert.type === "warning"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {alert.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getTimeAgo(alert.time)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="flex-shrink-0"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}

            {allAlerts.length > 10 && (
              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing 10 of {allAlerts.length} alerts
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Low Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when products fall below minimum threshold
                </p>
              </div>
              <Switch
                checked={prefs.lowStock}
                onCheckedChange={() => toggleSetting("lowStock")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Payment Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Notifications for overdue payments and payment received
                </p>
              </div>
              <Switch
                checked={prefs.payments}
                onCheckedChange={() => toggleSetting("payments")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Customer Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  New customer registrations and updates
                </p>
              </div>
              <Switch
                checked={prefs.customers}
                onCheckedChange={() => toggleSetting("customers")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>System Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  System maintenance and update notifications
                </p>
              </div>
              <Switch
                checked={prefs.system}
                onCheckedChange={() => toggleSetting("system")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send alerts via email in addition to in-app notifications
                </p>
              </div>
              <Switch
                checked={prefs.email}
                onCheckedChange={() => toggleSetting("email")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
