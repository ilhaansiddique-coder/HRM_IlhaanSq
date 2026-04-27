import { requireTenant } from "@/lib/auth";
import { resolveDateBounds, formatDateLabel } from "@/lib/date-range";
import { getReportsPageData } from "@/lib/services/reports.service";
import { ReportsRichView } from "./_components/reports-rich-view";
import { PageErrorState } from "../_components/page-error-state";

// Reports page — rich operational dashboard scoped to a date range.
//
// Why server-side: the histogram + items-sold grid + KPIs all share a
// single `fetchReportSales()` cut. Doing that aggregation on the
// server keeps the client bundle slim (no query-key plumbing, no
// loading skeletons after the first paint) and lets Next re-render
// the whole tree when the URL date filter changes.
//
// Super admins see cross-tenant aggregates (scope = null); tenant
// users see only their own (scope = tenantId).

type SearchParams = {
  range?: string;
  from?: string;
  to?: string;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireTenant();
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "today");
  const scope = session.isSuperAdmin ? null : session.tenantId;

  // See PageErrorState — wrapping the fetch keeps the route loadable
  // when the report aggregation throws (schema drift, DB connectivity)
  // and surfaces the actual reason instead of a blank 500.
  let data: Awaited<ReturnType<typeof getReportsPageData>>;
  try {
    data = await getReportsPageData(scope, start, end);
  } catch (e) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageErrorState title="Reports" error={e} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <ReportsRichView
        data={data}
        rangeLabel={formatDateLabel(start, end)}
        isSuperAdmin={session.isSuperAdmin}
      />
    </div>
  );
}
