import { requireTenant } from "@/lib/auth";
import { listJobPostings } from "@/lib/services/hr/recruitment.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase } from "lucide-react";
import { changeJobStatusAction } from "../../actions-phase2";
import { CopyJobUrlButton } from "./_components/copy-job-url-button";
import { JobRowActions } from "./_components/job-row-actions";
import { NewJobPostingDialog } from "./_components/new-job-posting-dialog";

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  open: "default",
  on_hold: "secondary",
  closed: "destructive",
};

export default async function JobsPage() {
  const session = await requireTenant();
  const jobs = await listJobPostings(session.tenantId);

  return (
    <div className="space-y-6">
      {/* The New Job Posting form opens from the "+" button in the top bar (left
          of the notification bell). Portals into the TopBar; nothing inline. */}
      <NewJobPostingDialog />

      <div className="space-y-3">
          {jobs.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No job postings yet</p>
              </CardContent>
            </Card>
          ) : (
            jobs.map((j) => (
              <Card key={j.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{j.title}</CardTitle>
                      <CardDescription>
                        {j.location ?? "Remote"} · {j.employmentType.replace("_", "-")} ·{" "}
                        {j.salaryMin && j.salaryMax ? `${j.currency} ${Number(j.salaryMin).toLocaleString()}–${Number(j.salaryMax).toLocaleString()}` : "Salary negotiable"}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground mt-1">{j._count.applications} applicant{j._count.applications !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusVariants[j.status]}>{j.status}</Badge>
                      {j.status === "open" && <CopyJobUrlButton jobId={j.id} />}
                      <JobRowActions
                        job={{
                          id: j.id,
                          title: j.title,
                          location: j.location,
                          employmentType: j.employmentType,
                          salaryMin:
                            j.salaryMin != null ? String(Number(j.salaryMin)) : null,
                          salaryMax:
                            j.salaryMax != null ? String(Number(j.salaryMax)) : null,
                          description: j.description,
                          requirements: j.requirements,
                        }}
                      />
                      <form action={changeJobStatusAction}>
                        <input type="hidden" name="id" value={j.id} />
                        <Select name="status" defaultValue={j.status}>
                          <SelectTrigger className="h-8 w-[110px] rounded-full text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <input type="submit" hidden />
                      </form>
                    </div>
                  </div>
                </CardHeader>
                {j.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">{j.description}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
    </div>
  );
}
