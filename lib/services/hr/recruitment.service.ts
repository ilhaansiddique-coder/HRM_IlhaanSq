import { prisma } from "../../db";
import type { ApplicationStage, JobPostingStatus } from "@prisma/client";
import { assertTenantOwns } from "./_shared";
import { createApprovalRequest } from "../approvals.service";

// ─── Job Postings ───────────────────────────────────────────

export async function listJobPostings(tenantId: string, status?: JobPostingStatus) {
  return prisma.jobPosting.findMany({
    where: { tenantId, ...(status && { status }) },
    include: {
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getJobById(jobId: string) {
  return prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function createJobPosting(
  tenantId: string,
  input: {
    title: string;
    departmentId?: string;
    positionId?: string;
    description: string;
    requirements?: string;
    employmentType?: any;
    salaryMin?: number;
    salaryMax?: number;
    location?: string;
    status?: JobPostingStatus;
  }
) {
  await assertTenantOwns(tenantId, "department", [input.departmentId]);
  await assertTenantOwns(tenantId, "position", [input.positionId]);

  return prisma.jobPosting.create({
    data: {
      tenantId,
      title: input.title,
      departmentId: input.departmentId || null,
      positionId: input.positionId || null,
      description: input.description,
      requirements: input.requirements,
      employmentType: input.employmentType ?? "full_time",
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      location: input.location,
      status: input.status ?? "draft",
      openedAt: input.status === "open" ? new Date() : null,
    },
  });
}

export async function updateJobPosting(
  tenantId: string,
  id: string,
  input: {
    title?: string;
    description?: string;
    requirements?: string | null;
    employmentType?: any;
    salaryMin?: number | null;
    salaryMax?: number | null;
    location?: string | null;
    status?: JobPostingStatus;
  }
) {
  const j = await prisma.jobPosting.findFirst({ where: { id, tenantId } });
  if (!j) throw new Error("Job not found");
  return prisma.jobPosting.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.requirements !== undefined && { requirements: input.requirements }),
      ...(input.employmentType !== undefined && {
        employmentType: input.employmentType,
      }),
      ...(input.salaryMin !== undefined && { salaryMin: input.salaryMin }),
      ...(input.salaryMax !== undefined && { salaryMax: input.salaryMax }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.status !== undefined && {
        status: input.status,
        openedAt:
          input.status === "open" && !j.openedAt ? new Date() : j.openedAt,
      }),
    },
  });
}

export async function deleteJobPosting(tenantId: string, id: string) {
  const j = await prisma.jobPosting.findFirst({ where: { id, tenantId } });
  if (!j) throw new Error("Job not found");
  // Applications cascade (FK onDelete: Cascade).
  await prisma.jobPosting.delete({ where: { id } });
}

export async function changeJobStatus(tenantId: string, id: string, status: JobPostingStatus) {
  const j = await prisma.jobPosting.findFirst({ where: { id, tenantId } });
  if (!j) throw new Error("Job not found");
  return prisma.jobPosting.update({
    where: { id },
    data: {
      status,
      openedAt: status === "open" && !j.openedAt ? new Date() : j.openedAt,
      closedAt: status === "closed" ? new Date() : null,
    },
  });
}

// ─── Candidates ─────────────────────────────────────────────

export async function listCandidates(tenantId: string) {
  return prisma.candidate.findMany({
    where: { tenantId },
    include: {
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCandidate(
  tenantId: string,
  input: {
    fullName: string;
    email: string;
    phone?: string;
    currentRole?: string;
    currentCompany?: string;
    linkedinUrl?: string;
    resumeUrl?: string;
    source?: string;
    notes?: string;
  }
) {
  return prisma.candidate.create({
    data: {
      tenantId,
      fullName: input.fullName,
      email: input.email.toLowerCase().trim(),
      phone: input.phone,
      currentRole: input.currentRole,
      currentCompany: input.currentCompany,
      linkedinUrl: input.linkedinUrl,
      resumeUrl: input.resumeUrl,
      source: input.source,
      notes: input.notes,
    },
  });
}

// ─── Applications (Pipeline) ────────────────────────────────

export async function listApplications(
  tenantId: string,
  filters: { from?: Date; to?: Date } = {}
) {
  const { from, to } = filters;
  return prisma.application.findMany({
    where: {
      tenantId,
      // Top-bar date filter — bounds by when the application was received.
      ...(from || to
        ? { appliedAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
    },
    include: {
      candidate: true,
      jobPosting: { select: { id: true, title: true } },
    },
    orderBy: { appliedAt: "desc" },
  });
}

export async function createApplication(
  tenantId: string,
  input: { candidateId: string; jobPostingId: string }
) {
  await assertTenantOwns(tenantId, "candidate", [input.candidateId]);
  await assertTenantOwns(tenantId, "jobPosting", [input.jobPostingId]);

  return prisma.application.create({
    data: {
      tenantId,
      candidateId: input.candidateId,
      jobPostingId: input.jobPostingId,
      stage: "applied",
    },
  });
}

export async function moveApplicationStage(
  tenantId: string,
  id: string,
  stage: ApplicationStage,
  extra?: { rejectionReason?: string; offerSalary?: number },
  actor?: { userId: string; name: string }
) {
  const app = await prisma.application.findFirst({
    where: { id, tenantId },
    include: {
      candidate: { select: { fullName: true, email: true } },
      jobPosting: { select: { title: true } },
    },
  });
  if (!app) throw new Error("Application not found");

  // Joining gate: moving to "hired" does NOT take effect immediately. It
  // raises a joining-approval request and parks the application until an
  // owner/admin approves it in /admin (which then sets stage = hired).
  if (stage === "hired" && app.joiningStatus !== "approved") {
    if (app.joiningStatus === "pending") return app; // already awaiting decision

    const updated = await prisma.application.update({
      where: { id },
      data: {
        joiningStatus: "pending",
        joiningRejectionReason: null,
        offerSalary: extra?.offerSalary ?? app.offerSalary,
      },
    });

    await createApprovalRequest({
      tenantId,
      type: "recruitment_joining",
      entityType: "Application",
      entityId: app.id,
      title: app.candidate.fullName,
      subtitle: `Joining for ${app.jobPosting.title}`,
      requestedBy: actor?.userId,
      requestedByName: actor?.name,
    });

    return updated;
  }

  return prisma.application.update({
    where: { id },
    data: {
      stage,
      rejectedAt: stage === "rejected" ? new Date() : null,
      rejectionReason: stage === "rejected" ? extra?.rejectionReason : null,
      hiredAt: stage === "hired" ? new Date() : null,
      offerSalary: stage === "offer" || stage === "hired" ? extra?.offerSalary : app.offerSalary,
    },
  });
}

export async function getRecruitmentStats(tenantId: string) {
  const [openJobs, totalApplicants, inPipeline, hired] = await Promise.all([
    prisma.jobPosting.count({ where: { tenantId, status: "open" } }),
    prisma.candidate.count({ where: { tenantId } }),
    prisma.application.count({
      where: { tenantId, stage: { in: ["applied", "screening", "interview", "offer"] } },
    }),
    prisma.application.count({ where: { tenantId, stage: "hired" } }),
  ]);
  return { openJobs, totalApplicants, inPipeline, hired };
}
