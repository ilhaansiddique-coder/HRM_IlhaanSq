"use server";

import { requireTenant } from "@/lib/auth";
import { setRequestActor } from "@/lib/request-actor";
import { revalidatePath } from "next/cache";
import type { HolidayType } from "@prisma/client";
import {
  createHoliday,
  deleteHoliday,
  setWeekendDays,
  seedBangladeshHolidays,
} from "@/lib/services/hr/holiday.service";

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
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add holiday" };
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

export async function seedBangladeshAction(): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await seedBangladeshHolidays(session.tenantId);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to seed holidays" };
  }
}