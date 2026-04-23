import { requireTenant } from "@/lib/auth";
import {
  getRevenueByDay,
  getTopProducts,
  getPaymentBreakdown,
} from "@/lib/services/reports.service";
import { ReportsView } from "./_components/reports-view";

export default async function ReportsPage() {
  const session = await requireTenant();

  const [revenueData, topProducts, paymentBreakdown] = await Promise.all([
    getRevenueByDay(session.tenantId, 30),
    getTopProducts(session.tenantId, 10),
    getPaymentBreakdown(session.tenantId),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Analytics for the last 30 days</p>
      </div>

      <ReportsView
        revenueData={revenueData}
        topProducts={topProducts}
        paymentBreakdown={paymentBreakdown}
      />
    </div>
  );
}
