"use server";

import { prisma } from "@/lib/db";
import { sendApplicationNotification } from "@/lib/email";
import { revalidatePath } from "next/cache";

export async function submitPublicApplication(formData: FormData) {
  const jobId = formData.get("jobId") as string;
  if (!jobId) return { ok: false as const, error: "Job ID is required" };

  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      tenantId: true,
      tenant: { select: { name: true } },
    },
  });
  if (!job || job.tenantId !== (formData.get("tenantId") as string)) {
    return { ok: false as const, error: "Job not found" };
  }

  const email = (formData.get("email") as string).toLowerCase().trim();
  const fullName = (formData.get("fullName") as string).trim();

  const candidate = await prisma.candidate.upsert({
    where: { tenantId_email: { tenantId: job.tenantId, email } },
    update: {
      fullName,
      phone: (formData.get("phone") as string) || undefined,
      currentRole: (formData.get("currentRole") as string) || undefined,
      currentCompany: (formData.get("currentCompany") as string) || undefined,
      resumeUrl: (formData.get("resumeUrl") as string) || undefined,
      linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
      source: "careers_page",
      notes: (formData.get("notes") as string) || undefined,
    },
    create: {
      tenantId: job.tenantId,
      fullName,
      email,
      phone: (formData.get("phone") as string) || undefined,
      currentRole: (formData.get("currentRole") as string) || undefined,
      currentCompany: (formData.get("currentCompany") as string) || undefined,
      resumeUrl: (formData.get("resumeUrl") as string) || undefined,
      linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
      source: "careers_page",
      notes: (formData.get("notes") as string) || undefined,
    },
  });

  await prisma.application.create({
    data: {
      tenantId: job.tenantId,
      candidateId: candidate.id,
      jobPostingId: job.id,
      stage: "applied",
      notes: (formData.get("notes") as string) || undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      tenantId: job.tenantId,
      userId: candidate.id,
      action: "public_application_submitted",
      entityType: "application",
      entityId: job.id,
      details: {
        candidateName: fullName,
        candidateEmail: email,
        jobTitle: job.title,
      },
    },
  });

  const admins = await prisma.tenantMember.findMany({
    where: { tenantId: job.tenantId },
    select: {
      user: { select: { email: true, fullName: true } },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const adminUrl = `${appUrl}/hr/recruitment/pipeline`;

  for (const member of admins) {
    if (member.user?.email) {
      sendApplicationNotification({
        to: member.user.email,
        applicantName: fullName,
        applicantEmail: email,
        jobTitle: job.title,
        tenantName: job.tenant.name,
        adminUrl,
        phone: (formData.get("phone") as string) || undefined,
        notes: (formData.get("notes") as string) || undefined,
      }).catch((err) => console.error("[careers] admin email failed:", err));
    }
  }

  revalidatePath("/hr/recruitment/pipeline");
  revalidatePath("/hr/recruitment");
  return { ok: true as const, message: "Application submitted successfully!" };
}
