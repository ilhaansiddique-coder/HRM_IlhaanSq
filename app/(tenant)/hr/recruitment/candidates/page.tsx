import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listCandidates, listJobPostings } from "@/lib/services/hr/recruitment.service";
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
import { ArrowLeft, Plus, Users } from "lucide-react";
import { createCandidateAction, createApplicationAction } from "../../actions-phase2";

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground">{candidates.length} candidate{candidates.length !== 1 ? "s" : ""} in the talent pool</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Add Candidate</CardTitle></CardHeader>
          <CardContent>
            <form action={createCandidateAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs">Full name *</Label>
                <Input id="fullName" name="fullName" required minLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email *</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">Phone</Label>
                <Input id="phone" name="phone" type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currentRole" className="text-xs">Current role</Label>
                <Input id="currentRole" name="currentRole" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currentCompany" className="text-xs">Current company</Label>
                <Input id="currentCompany" name="currentCompany" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedinUrl" className="text-xs">LinkedIn URL</Label>
                <Input id="linkedinUrl" name="linkedinUrl" type="url" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source" className="text-xs">Source</Label>
                <Select name="source" defaultValue="direct">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="job_board">Job Board</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Add Candidate</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
