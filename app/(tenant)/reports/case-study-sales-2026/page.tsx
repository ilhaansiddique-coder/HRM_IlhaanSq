import { requireTenant } from "@/lib/auth";
import { resolveDateBounds, formatDateLabel } from "@/lib/date-range";
import { getCaseStudyData } from "@/lib/services/reports.service";
import { CaseStudyView } from "./_components/case-study-view";

// Sales Case Study 2026 — narrative business review.
//
// Default window is Jan 1 – Mar 10, 2026 (the case-study window from
// the spec). When the user adjusts the date filter via the URL, we
// honour that instead — same range/from/to query-param contract as
// /reports.
const CASE_STUDY_DEFAULT_START = new Date("2026-01-01T00:00:00.000");
const CASE_STUDY_DEFAULT_END = new Date("2026-03-10T23:59:59.999");

type SearchParams = {
  range?: string;
  from?: string;
  to?: string;
};

export default async function SalesCaseStudy2026Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireTenant();
  const sp = await searchParams;

  // If the user lands without any filter, prefer the spec window over
  // the picker's "today" fallback. Once they touch the picker the URL
  // params take over and we honour their selection.
  const userOverrode = !!(sp.range || (sp.from && sp.to));
  const { start, end } = userOverrode
    ? resolveDateBounds(sp.range, sp.from, sp.to, "this_year")
    : { start: CASE_STUDY_DEFAULT_START, end: CASE_STUDY_DEFAULT_END };

  const scope = session.isSuperAdmin ? null : session.tenantId;
  const data = await getCaseStudyData(scope, start, end);

  return (
    <div className="space-y-4 md:space-y-6">
      <CaseStudyView
        data={data}
        rangeLabel={formatDateLabel(start, end)}
        isSuperAdmin={session.isSuperAdmin}
      />
    </div>
  );
}
