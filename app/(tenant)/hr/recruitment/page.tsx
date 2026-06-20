import type { ReactNode } from "react";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getRecruitmentStats, listApplications } from "@/lib/services/hr/recruitment.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard as MetricCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, GitBranch, Users, Award, ArrowRight } from "lucide-react";
import { NewJobPostingDialog } from "./jobs/_components/new-job-posting-dialog";
import { resolveDateBounds } from "@/lib/date-range";

export default async function RecruitmentOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireTenant();
  // Top-bar date filter bounds the applications list by appliedAt (all-time
  // default). The KPI cards are current-pipeline state and stay as snapshots.
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "all_time");
  const [stats, recentApps] = await Promise.all([
    getRecruitmentStats(session.tenantId),
    listApplications(session.tenantId, {
      ...(start && { from: start }),
      ...(end && { to: end }),
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* New Job Posting form opens from the "+" button in the top bar (left of
          the notification bell). Candidates and Jobs are now in the sidebar. */}
      <NewJobPostingDialog />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<Briefcase className="h-4 w-4" />} title="Open Jobs" value={stats.openJobs} variant="default" />
        <StatCard icon={<Users className="h-4 w-4" />} title="Total Candidates" value={stats.totalApplicants} />
        <StatCard icon={<GitBranch className="h-4 w-4" />} title="In Pipeline" value={stats.inPipeline} variant="success" />
        <StatCard icon={<Award className="h-4 w-4" />} title="Hired" value={stats.hired} variant="success" />
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />Recent Applications</CardTitle>
            <CardDescription>Latest activity in the pipeline</CardDescription>
          </div>
          <Link href="/hr/recruitment/pipeline"><Button variant="ghost" size="sm">View pipeline<ArrowRight className="h-3 w-3" /></Button></Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentApps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No applications yet</p>
          ) : (
            recentApps.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.candidate.fullName}</p>
                  <p className="text-xs text-muted-foreground">{a.jobPosting.title} · Applied {new Date(a.appliedAt).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="capitalize">{a.stage}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, title, value, variant }: { icon: ReactNode; title: string; value: number; variant?: "default" | "success" }) {
  return (
    <MetricCard
      icon={icon}
      label={title}
      value={typeof value === "number" ? value.toLocaleString() : value}
      tone={
        variant === "success"
          ? "success"
          : "primary"
      }
    />
  );
}
