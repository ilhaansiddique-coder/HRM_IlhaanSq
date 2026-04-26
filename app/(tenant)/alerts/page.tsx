import { requireTenant } from "@/lib/auth";
import { tenantDb } from "@/lib/db";
import { getCachedBusinessSettings } from "@/lib/cache";
import { AlertsView, type SerializedAlert } from "./_components/alerts-view";

// /alerts — server component. Aggregates everything that should
// surface as an alert (out-of-stock, low-stock, overdue invoices,
// large pending payments, recent + VIP customers) into a single
// SerializedAlert[] that the client view renders.
//
// The element hierarchy mirrors the Vite reference page at
// src/views/Alerts.tsx (the same code the dev server at 192.168.0.127:8081
// renders): 4 KPI cards on top, 2-column grid below (Recent Alerts +
// Preferences). Vite version uses live React-Query hooks; this Next
// version does the same aggregation server-side via Prisma.

export default async function AlertsPage() {
  const session = await requireTenant();
  const db = tenantDb(session.tenantId);

  // Threshold for low-stock alerts comes from BusinessSettings; falls
  // back to 12 to match the Vite reference (`businessSettings?.low_stock_alert_quantity || 12`).
  const businessSettings = await getCachedBusinessSettings(session.tenantId);
  const lowStockThreshold = businessSettings?.lowStockAlertQuantity ?? 12;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [products, overdueSales, largePending, newCustomers, vipRecent] =
    await Promise.all([
      // All products at or below the threshold (we'll split into
      // critical=out / warning=low when generating alerts).
      db.product.findMany({
        where: { isDeleted: false, stockQuantity: { lte: lowStockThreshold } },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          updatedAt: true,
        },
        orderBy: { stockQuantity: "asc" },
        take: 200,
      }),
      // Overdue: created >30d ago, not paid, not cancelled.
      db.sale.findMany({
        where: {
          isDeleted: false,
          paymentStatus: { in: ["pending", "partial"] },
          createdAt: { lt: thirtyDaysAgo },
          courierStatus: { notIn: ["cancelled", "returned", "lost"] },
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          amountDue: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      // Large pending payments — amount_due > 10,000 (matches the Vite
      // reference's threshold).
      db.sale.findMany({
        where: {
          isDeleted: false,
          paymentStatus: "pending",
          amountDue: { gt: 10000 },
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          amountDue: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      // New customers in the last 7 days.
      db.customer.findMany({
        where: { isDeleted: false, createdAt: { gt: sevenDaysAgo } },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // VIP recent: total_spent > 50,000 AND last_purchase_date within 3 days.
      db.customer.findMany({
        where: {
          isDeleted: false,
          totalSpent: { gt: 50000 },
          lastPurchaseDate: {
            gt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          name: true,
          totalSpent: true,
          lastPurchaseDate: true,
        },
        orderBy: { lastPurchaseDate: "desc" },
        take: 3,
      }),
    ]);

  // Currency formatter — server-side fallback. The Vite version uses
  // a per-tenant currency hook; for simplicity we use the bare number
  // and let the client format if needed. If your business setting has a
  // currencyCode we can prepend the symbol later.
  const fmtAmount = (n: number) => n.toLocaleString();

  const alerts: SerializedAlert[] = [];

  // Out of stock (critical) — stockQuantity === 0
  for (const p of products) {
    if (p.stockQuantity === 0) {
      alerts.push({
        id: `out-of-stock-${p.id}`,
        type: "critical",
        category: "inventory",
        title: "Product Out of Stock",
        message: `${p.name}${p.sku ? ` (${p.sku})` : ""} is completely out of stock`,
        time: p.updatedAt.toISOString(),
        iconKey: "alert-triangle",
        actionable: true,
      });
    }
  }
  // Low stock (warning) — between 1 and threshold inclusive
  for (const p of products) {
    if (p.stockQuantity > 0 && p.stockQuantity <= lowStockThreshold) {
      alerts.push({
        id: `low-stock-${p.id}`,
        type: "warning",
        category: "inventory",
        title: "Low Stock Alert",
        message: `${p.name} is below minimum threshold (${p.stockQuantity} remaining, threshold: ${lowStockThreshold})`,
        time: p.updatedAt.toISOString(),
        iconKey: "package",
        actionable: true,
      });
    }
  }

  // Overdue invoices
  for (const s of overdueSales) {
    const dueDate = new Date(s.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysOverdue = Math.max(
      0,
      Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    alerts.push({
      id: `overdue-${s.id}`,
      type: daysOverdue > 15 ? "critical" : "warning",
      category: "payment",
      title: "Overdue Invoice",
      message: `Invoice ${s.invoiceNumber} is ${daysOverdue} days overdue (${s.customerName}) - ${fmtAmount(Number(s.amountDue ?? 0))} due`,
      time: s.createdAt.toISOString(),
      iconKey: "info",
      actionable: true,
    });
  }

  // Large pending payments
  for (const s of largePending) {
    alerts.push({
      id: `large-pending-${s.id}`,
      type: "info",
      category: "payment",
      title: "Large Pending Payment",
      message: `Invoice ${s.invoiceNumber} has a large pending amount: ${fmtAmount(Number(s.amountDue ?? 0))}`,
      time: s.createdAt.toISOString(),
      iconKey: "trending-up",
      actionable: true,
    });
  }

  // New customers
  for (const c of newCustomers) {
    alerts.push({
      id: `new-customer-${c.id}`,
      type: "info",
      category: "customer",
      title: "New Customer",
      message: `${c.name} joined recently`,
      time: c.createdAt.toISOString(),
      iconKey: "users",
      actionable: false,
    });
  }

  // VIP recent activity
  for (const c of vipRecent) {
    alerts.push({
      id: `vip-activity-${c.id}`,
      type: "info",
      category: "customer",
      title: "VIP Customer Activity",
      message: `${c.name} (spent ${fmtAmount(Number(c.totalSpent ?? 0))}) made a recent purchase`,
      time: (c.lastPurchaseDate ?? now).toISOString(),
      iconKey: "trending-up",
      actionable: false,
    });
  }

  return <AlertsView initialAlerts={alerts} />;
}
