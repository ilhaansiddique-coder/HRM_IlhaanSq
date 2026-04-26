"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "../../dashboard/_components/date-range-picker";

// Slotted into the TopBar's left cluster on /reports and
// /reports/case-study-sales-2026. Pairs the shared DateRangePicker
// with a context-aware secondary action:
//   /reports                          → "Case Study" link
//   /reports/case-study-sales-2026    → "Back to Reports"
export function ReportsHeaderControls() {
  const pathname = usePathname();
  const onCaseStudy = pathname.startsWith("/reports/case-study-sales-2026");

  return (
    <div className="flex items-center gap-2">
      <DateRangePicker />
      {onCaseStudy ? (
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Reports
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports/case-study-sales-2026">
            <BookOpen className="mr-1 h-4 w-4" />
            Case Study
          </Link>
        </Button>
      )}
    </div>
  );
}
