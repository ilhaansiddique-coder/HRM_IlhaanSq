import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listApplications } from "@/lib/services/hr/recruitment.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitBranch } from "lucide-react";
import { PipelineStageMover } from "./_components/pipeline-stage-mover";

const STAGES: Array<{ key: any; label: string; color: string }> = [
  { key: "applied", label: "Applied", color: "bg-muted" },
  { key: "screening", label: "Screening", color: "bg-info/15" },
  { key: "interview", label: "Interview", color: "bg-warning/15" },
  { key: "offer", label: "Offer", color: "bg-secondary/15" },
  { key: "hired", label: "Hired", color: "bg-success/15" },
  { key: "rejected", label: "Rejected", color: "bg-destructive/15" },
];

export default async function PipelinePage() {
  const session = await requireTenant();
  const applications = await listApplications(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/recruitment"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {applications.length === 0 ? (
        <Card className="border-border/70 bg-card/40">
          <CardContent className="py-16 text-center">
            <GitBranch className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No applications yet. <Link href="/hr/recruitment/candidates" className="text-primary underline">Add candidates</Link> and apply them to open jobs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((stage) => {
            const stageApps = applications.filter((a) => a.stage === stage.key);
            return (
              <div key={stage.key} className={`rounded-xl border border-border/60 p-3 ${stage.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <span className="text-xs font-mono text-muted-foreground">{stageApps.length}</span>
                </div>
                <div className="space-y-2">
                  {stageApps.map((a) => (
                    <Card key={a.id} className="bg-background/80 border-border/60">
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <p className="text-sm font-medium leading-tight">{a.candidate.fullName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{a.jobPosting.title}</p>
                        </div>
                        <PipelineStageMover applicationId={a.id} currentStage={a.stage} />
                      </CardContent>
                    </Card>
                  ))}
                  {stageApps.length === 0 && <p className="text-[10px] text-muted-foreground/60 text-center py-2">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
