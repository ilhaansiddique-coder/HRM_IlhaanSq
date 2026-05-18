import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listJobPostings } from "@/lib/services/hr/recruitment.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Briefcase } from "lucide-react";
import {
  createJobAction,
  changeJobStatusAction,
} from "../../actions-phase2";
import { CopyJobUrlButton } from "./_components/copy-job-url-button";
import { JobRowActions } from "./_components/job-row-actions";

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
      <div className="flex items-center gap-3">
        <Link href="/hr/recruitment"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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
                          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
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

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />New Job Posting</CardTitle></CardHeader>
          <CardContent>
            <form action={createJobAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">Title *</Label>
                <Input id="title" name="title" required minLength={2} placeholder="Senior Sales Manager" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-xs">Location</Label>
                <Input id="location" name="location" placeholder="Dhaka / Remote" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employmentType" className="text-xs">Type</Label>
                <Select name="employmentType" defaultValue="full_time">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="salaryMin" className="text-xs">Min Salary</Label>
                  <Input id="salaryMin" name="salaryMin" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="salaryMax" className="text-xs">Max Salary</Label>
                  <Input id="salaryMax" name="salaryMax" type="number" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description *</Label>
                <Textarea id="description" name="description" rows={3} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requirements" className="text-xs">Requirements</Label>
                <Textarea id="requirements" name="requirements" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs">Status</Label>
                <Select name="status" defaultValue="draft">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="open">Open immediately</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Create Posting</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
