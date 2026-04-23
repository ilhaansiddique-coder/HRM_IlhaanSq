import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getRecruitmentStats, listApplications } from "@/lib/services/hr/recruitment.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, UserPlus, GitBranch, Users, Award, ArrowRight } from "lucide-react";

export default async function RecruitmentOverviewPage() {
  const session = await requireTenant();
  const [stats, recentApps] = await Promise.all([
    getRecruitmentStats(session.tenantId),
    listApplications(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recruitment</h1>
          <p className="text-sm text-muted-foreground">Jobs, candidates and hiring pipeline</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hr/recruitment/candidates"><Button variant="outline"><UserPlus className="h-4 w-4" />Candidates</Button></Link>
          <Link href="/hr/recruitment/jobs"><Button><Briefcase className="h-4 w-4" />Jobs</Button></Link>
        </div>
      </div>

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

function StatCard({ icon, title, value, variant }: { icon: React.ReactNode; title: string; value: number; variant?: "default" | "success" }) {
  const iconBg = variant === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>{icon}</div>
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value.toLocaleString()}</div></CardContent>
    </Card>
  );
}
