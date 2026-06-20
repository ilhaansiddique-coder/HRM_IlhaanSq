"use server";

import { requireTenant } from "@/lib/auth";
import { setRequestActor } from "@/lib/request-actor";
import { revalidatePath } from "next/cache";
import type { HolidayType } from "@prisma/client";
import {
  createHoliday,
  createHolidayRange,
  deleteHoliday,
  deleteHolidays,
  confirmHolidays,
  applyHolidayToEmployees,
  getHolidayApplications,
  setWeekendDays,
} from "@/lib/services/hr/holiday.service";
import { listEmployees } from "@/lib/services/hr/employee.service";

type ActionResult = { ok: boolean; error?: string };

function assertAdmin(role: string | null) {
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    throw new Error("Only admins can manage holidays");
  }
}

export async function createHolidayAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    const dateStr = (formData.get("date") as string) ?? "";
    if (!dateStr) throw new Error("Date is required");
    await createHoliday(session.tenantId, {
      date: new Date(dateStr),
      name: (formData.get("name") as string) ?? "",
      type: ((formData.get("type") as string) || "public") as HolidayType,
      isRecurring: formData.get("isRecurring") === "on",
      isTentative: formData.get("isTentative") === "on",
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add holiday" };
  }
}

/** Add a multi-day Eid/lunar block (one holiday per day in the range). */
export async function createHolidayRangeAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    const start = (formData.get("date") as string) ?? "";
    const end = (formData.get("endDate") as string) ?? "";
    if (!start || !end) throw new Error("Start and end dates are required");
    await createHolidayRange(session.tenantId, {
      startDate: new Date(start),
      endDate: new Date(end),
      name: (formData.get("name") as string) ?? "",
      type: ((formData.get("type") as string) || "public") as HolidayType,
      isTentative: formData.get("isTentative") === "on",
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add holidays" };
  }
}

/** Delete a whole block of holiday days (e.g. an Eid window) at once. */
export async function deleteHolidaysAction(ids: string[]): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await deleteHolidays(session.tenantId, ids);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete holidays" };
  }
}

/** Confirm tentative (lunar) holidays once the moon-sighting date is announced. */
export async function confirmHolidaysAction(ids: string[]): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await confirmHolidays(session.tenantId, ids);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to confirm holidays" };
  }
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await deleteHoliday(session.tenantId, id);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete holiday" };
  }
}

export async function setWeekendAction(days: number[]): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await setWeekendDays(session.tenantId, days);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to set weekend" };
  }
}

export type ApplyDialogData = {
  employees: { id: string; fullName: string; empCode: string; department: string | null }[];
  applied: string[]; // employee ids that currently have this holiday applied
};

/** Load the employee list + who already has this holiday applied (for the dialog). */
export async function loadHolidayApplyDataAction(
  holidayIds: string[]
): Promise<ApplyDialogData | null> {
  try {
    const session = await requireTenant();
    assertAdmin(session.role);
    const [employees, applied] = await Promise.all([
      listEmployees(session.tenantId, { status: "active" }),
      getHolidayApplications(session.tenantId, holidayIds),
    ]);
    return {
      employees: employees.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        empCode: e.empCode,
        department: e.department?.name ?? null,
      })),
      applied,
    };
  } catch {
    return null;
  }
}

/** Apply (or update) a holiday's off-days for the chosen employees. */
export async function applyHolidayAction(
  holidayIds: string[],
  employeeIds: string[]
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await applyHolidayToEmployees(session.tenantId, holidayIds, employeeIds);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to apply holiday" };
  }
}