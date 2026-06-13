import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listCandidates, listJobPostings } from "@/lib/services/hr/recruitment.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Users } from "lucide-react";
import { createApplicationAction } from "../../actions-phase2";
import { AddCandidateDialog } from "./_components/add-candidate-dialog";

export default async function CandidatesPage() {
  const session = await requireTenant();
  const [candidates, jobs] = await Promise.all([
    listCandidates(session.tenantId),
    listJobPostings(session.tenantId, "open"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/recruitment"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {/* The Add Candidate form opens from the "+" button in the top bar (left of
          the notification bell). Portals into the TopBar; nothing inline here. */}
      <AddCandidateDialog />

      <div className="space-y-3">
          {candidates.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No candidates yet</p>
              </CardContent>
            </Card>
          ) : (
            candidates.map((c) => (
              <Card key={c.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{c.fullName}</CardTitle>
                      <CardDescription>
                        {c.email} {c.phone && `· ${c.phone}`}
                      </CardDescription>
                      {c.currentRole && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.currentRole} {c.currentCompany && `at ${c.currentCompany}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {c._count.applications} application{c._count.applications !== 1 ? "s" : ""} · Source: {c.source ?? "direct"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                {jobs.length > 0 && (
                  <CardContent className="pt-0">
                    <form action={createApplicationAction} className="flex gap-2">
                      <input type="hidden" name="candidateId" value={c.id} />
                      <Select name="jobPostingId" required>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Apply to job..." /></SelectTrigger>
                        <SelectContent>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="submit" size="sm">Apply</Button>
                    </form>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
    </div>
  );
}
