import { notFound } from "next/navigation";
import { getJobById } from "@/lib/services/hr/recruitment.service";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin, DollarSign } from "lucide-react";
import { ApplyForm } from "./_components/apply-form";

export default async function PublicCareersJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJobById(jobId);
  if (!job || job.status !== "open") notFound();
  if (!job.tenant?.slug) notFound();

  const employmentTypeLabels: Record<string, string> = {
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract",
    intern: "Intern",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {job.title}
              </h1>
              <p className="mt-1 text-muted-foreground">
                at {job.tenant.name}
              </p>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                {employmentTypeLabels[job.employmentType] ?? job.employmentType}
              </Badge>
              {job.location && (
                <Badge variant="outline" className="gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </Badge>
              )}
              {job.salaryMin && job.salaryMax && (
                <Badge variant="outline" className="gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  {job.currency} {Number(job.salaryMin).toLocaleString()} –{" "}
                  {Number(job.salaryMax).toLocaleString()}
                </Badge>
              )}
            </div>

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <h3 className="text-lg font-semibold">Description</h3>
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80"
                dangerouslySetInnerHTML={{
                  __html: job.description.replace(/\n/g, "<br />"),
                }}
              />

              {job.requirements && (
                <>
                  <h3 className="mt-8 text-lg font-semibold">Requirements</h3>
                  <div
                    className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80"
                    dangerouslySetInnerHTML={{
                      __html: job.requirements.replace(/\n/g, "<br />"),
                    }}
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <div className="sticky top-24">
              <ApplyForm
                jobId={job.id}
                tenantId={job.tenant.id}
                jobTitle={job.title}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
