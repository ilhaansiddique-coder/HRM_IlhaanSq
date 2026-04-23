"use server";

import { requireTenant } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ─── PAYROLL ────────────────────────────────────────────────

import {
  createSalaryStructure,
  addSalaryComponent,
  deleteSalaryComponent,
  runPayroll,
  assignSalary,
} from "@/lib/services/hr/payroll.service";

export async function createSalaryStructureAction(formData: FormData) {
  const session = await requireTenant();
  await createSalaryStructure(session.tenantId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  });
  revalidatePath("/hr/payroll/structures");
}

export async function addSalaryComponentAction(formData: FormData) {
  const session = await requireTenant();
  await addSalaryComponent(session.tenantId, {
    structureId: formData.get("structureId") as string,
    name: formData.get("name") as string,
    code: formData.get("code") as string,
    type: formData.get("type") as any,
    calculationType: formData.get("calculationType") as any,
    value: parseFloat(formData.get("value") as string),
    taxable: formData.get("taxable") === "on",
    isStatutory: formData.get("isStatutory") === "on",
  });
  revalidatePath("/hr/payroll/structures");
}

export async function deleteSalaryComponentAction(formData: FormData) {
  const session = await requireTenant();
  await deleteSalaryComponent(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/payroll/structures");
}

export async function runPayrollAction(formData: FormData) {
  const session = await requireTenant();
  await runPayroll(session.tenantId, {
    name: formData.get("name") as string,
    periodStart: new Date(formData.get("periodStart") as string),
    periodEnd: new Date(formData.get("periodEnd") as string),
    payDate: new Date(formData.get("payDate") as string),
    runBy: session.userId,
  });
  revalidatePath("/hr/payroll/runs");
  revalidatePath("/hr/payroll");
}

export async function assignSalaryAction(formData: FormData) {
  const session = await requireTenant();
  await assignSalary(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    structureId: formData.get("structureId") as string,
    baseSalary: parseFloat(formData.get("baseSalary") as string),
    currency: (formData.get("currency") as string) || "BDT",
    effectiveFrom: new Date(formData.get("effectiveFrom") as string),
  });
  revalidatePath("/hr/payroll");
}

// ─── PERFORMANCE ────────────────────────────────────────────

import {
  createReviewCycle,
  activateCycle,
  closeCycle,
  createGoal,
  updateGoalProgress,
  deleteGoal,
  createReview,
} from "@/lib/services/hr/performance.service";

export async function createCycleAction(formData: FormData) {
  const session = await requireTenant();
  await createReviewCycle(session.tenantId, {
    name: formData.get("name") as string,
    type: (formData.get("type") as string) || "annual",
    startDate: new Date(formData.get("startDate") as string),
    endDate: new Date(formData.get("endDate") as string),
  });
  revalidatePath("/hr/performance/cycles");
}

export async function activateCycleAction(formData: FormData) {
  const session = await requireTenant();
  await activateCycle(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/performance/cycles");
}

export async function closeCycleAction(formData: FormData) {
  const session = await requireTenant();
  await closeCycle(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/performance/cycles");
}

export async function createGoalAction(formData: FormData) {
  const session = await requireTenant();
  await createGoal(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    cycleId: (formData.get("cycleId") as string) || undefined,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    type: formData.get("type") as any,
    targetValue: formData.get("targetValue")
      ? parseFloat(formData.get("targetValue") as string)
      : undefined,
    unit: (formData.get("unit") as string) || undefined,
    weight: formData.get("weight")
      ? parseInt(formData.get("weight") as string, 10)
      : undefined,
  });
  revalidatePath("/hr/performance/goals");
}

export async function updateGoalAction(formData: FormData) {
  const session = await requireTenant();
  await updateGoalProgress(session.tenantId, formData.get("id") as string, {
    currentValue: formData.get("currentValue")
      ? parseFloat(formData.get("currentValue") as string)
      : undefined,
    progress: formData.get("progress")
      ? parseInt(formData.get("progress") as string, 10)
      : undefined,
  });
  revalidatePath("/hr/performance/goals");
}

export async function deleteGoalAction(formData: FormData) {
  const session = await requireTenant();
  await deleteGoal(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/performance/goals");
}

export async function createReviewAction(formData: FormData) {
  const session = await requireTenant();
  await createReview(session.tenantId, {
    cycleId: formData.get("cycleId") as string,
    employeeId: formData.get("employeeId") as string,
    reviewerId: formData.get("reviewerId") as string,
    type: formData.get("type") as any,
    overallRating: formData.get("overallRating")
      ? parseInt(formData.get("overallRating") as string, 10)
      : undefined,
    strengths: (formData.get("strengths") as string) || undefined,
    improvements: (formData.get("improvements") as string) || undefined,
    comments: (formData.get("comments") as string) || undefined,
  });
  revalidatePath("/hr/performance/reviews");
}

// ─── RECRUITMENT ────────────────────────────────────────────

import {
  createJobPosting,
  changeJobStatus,
  createCandidate,
  createApplication,
  moveApplicationStage,
} from "@/lib/services/hr/recruitment.service";

export async function createJobAction(formData: FormData) {
  const session = await requireTenant();
  await createJobPosting(session.tenantId, {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    requirements: (formData.get("requirements") as string) || undefined,
    employmentType: (formData.get("employmentType") as any) ?? "full_time",
    salaryMin: formData.get("salaryMin")
      ? parseFloat(formData.get("salaryMin") as string)
      : undefined,
    salaryMax: formData.get("salaryMax")
      ? parseFloat(formData.get("salaryMax") as string)
      : undefined,
    location: (formData.get("location") as string) || undefined,
    status: (formData.get("status") as any) ?? "draft",
  });
  revalidatePath("/hr/recruitment/jobs");
  revalidatePath("/hr/recruitment");
}

export async function changeJobStatusAction(formData: FormData) {
  const session = await requireTenant();
  await changeJobStatus(
    session.tenantId,
    formData.get("id") as string,
    formData.get("status") as any
  );
  revalidatePath("/hr/recruitment/jobs");
}

export async function createCandidateAction(formData: FormData) {
  const session = await requireTenant();
  await createCandidate(session.tenantId, {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || undefined,
    currentRole: (formData.get("currentRole") as string) || undefined,
    currentCompany: (formData.get("currentCompany") as string) || undefined,
    linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
    resumeUrl: (formData.get("resumeUrl") as string) || undefined,
    source: (formData.get("source") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });
  revalidatePath("/hr/recruitment/candidates");
}

export async function createApplicationAction(formData: FormData) {
  const session = await requireTenant();
  await createApplication(session.tenantId, {
    candidateId: formData.get("candidateId") as string,
    jobPostingId: formData.get("jobPostingId") as string,
  });
  revalidatePath("/hr/recruitment/pipeline");
}

export async function moveStageAction(formData: FormData) {
  const session = await requireTenant();
  await moveApplicationStage(
    session.tenantId,
    formData.get("id") as string,
    formData.get("stage") as any,
    {
      rejectionReason: (formData.get("rejectionReason") as string) || undefined,
      offerSalary: formData.get("offerSalary")
        ? parseFloat(formData.get("offerSalary") as string)
        : undefined,
    }
  );
  revalidatePath("/hr/recruitment/pipeline");
}

// ─── LEARNING ───────────────────────────────────────────────

import {
  createCourse,
  publishCourse,
  addCourseModule,
  enrollEmployee,
  updateEnrollmentProgress,
} from "@/lib/services/hr/learning.service";

export async function createCourseAction(formData: FormData) {
  const session = await requireTenant();
  await createCourse(session.tenantId, {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    category: (formData.get("category") as string) || undefined,
    durationHours: formData.get("durationHours")
      ? parseInt(formData.get("durationHours") as string, 10)
      : undefined,
    level: (formData.get("level") as any) ?? "beginner",
    instructorName: (formData.get("instructorName") as string) || undefined,
    isPublished: formData.get("isPublished") === "on",
  });
  revalidatePath("/hr/learning/courses");
}

export async function publishCourseAction(formData: FormData) {
  const session = await requireTenant();
  await publishCourse(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/learning/courses");
}

export async function enrollAction(formData: FormData) {
  const session = await requireTenant();
  await enrollEmployee(session.tenantId, {
    courseId: formData.get("courseId") as string,
    employeeId: formData.get("employeeId") as string,
  });
  revalidatePath("/hr/learning/enrollments");
}

export async function updateProgressAction(formData: FormData) {
  const session = await requireTenant();
  await updateEnrollmentProgress(
    session.tenantId,
    formData.get("id") as string,
    parseInt(formData.get("progress") as string, 10)
  );
  revalidatePath("/hr/learning/enrollments");
}

// ─── DOCUMENTS ──────────────────────────────────────────────

import {
  createDocumentCategory,
  deleteDocumentCategory,
  createDocument,
  markDocumentSigned,
  deleteDocument,
} from "@/lib/services/hr/documents.service";

export async function createDocCategoryAction(formData: FormData) {
  const session = await requireTenant();
  await createDocumentCategory(session.tenantId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    retentionDays: formData.get("retentionDays")
      ? parseInt(formData.get("retentionDays") as string, 10)
      : undefined,
    isRequired: formData.get("isRequired") === "on",
  });
  revalidatePath("/hr/documents/categories");
}

export async function deleteDocCategoryAction(formData: FormData) {
  const session = await requireTenant();
  await deleteDocumentCategory(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/documents/categories");
}

export async function createDocumentAction(formData: FormData) {
  const session = await requireTenant();
  await createDocument(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    categoryId: (formData.get("categoryId") as string) || undefined,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    fileUrl: (formData.get("fileUrl") as string) || undefined,
    expiresAt: formData.get("expiresAt")
      ? new Date(formData.get("expiresAt") as string)
      : undefined,
    uploadedBy: session.userId,
  });
  revalidatePath("/hr/documents");
}

export async function signDocumentAction(formData: FormData) {
  const session = await requireTenant();
  await markDocumentSigned(
    session.tenantId,
    formData.get("id") as string,
    (formData.get("signedByName") as string) || session.name
  );
  revalidatePath("/hr/documents");
}

export async function deleteDocumentAction(formData: FormData) {
  const session = await requireTenant();
  await deleteDocument(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/documents");
}
