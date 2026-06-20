"use server";

import { requireTenant } from "@/lib/auth";
import { setRequestActor } from "@/lib/request-actor";
import { revalidatePath } from "next/cache";
import {
  toggleOffDay,
  toggleWeekdayOff,
  setLunch,
  setCustomSchedule,
  getScheduleMonth,
  type ScheduleMonth,
} from "@/lib/services/hr/schedule.service";

type ActionResult = { ok: boolean; error?: string; off?: boolean };

/** Fetch a month's grid (used by the client grid when navigating months). */
export async function getScheduleMonthAction(
  year: number,
  month: number
): Promise<ScheduleMonth | null> {
  try {
    const session = await requireTenant();
    assertAdmin(session.role);
    return await getScheduleMonth(session.tenantId, year, month);
  } catch {
    return null;
  }
}

function assertAdmin(role: string | null) {
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    throw new Error("Only admins can manage schedules");
  }
}

export async function toggleOffDayAction(
  employeeId: string,
  dateISO: string
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    const { off } = await toggleOffDay(session.tenantId, employeeId, dateISO);
    revalidatePath("/settings");
    return { ok: true, off };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to toggle off day" };
  }
}

export async function setLunchAction(
  employeeId: string,
  start: string,
  end: string
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await setLunch(session.tenantId, employeeId, start, end);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save lunch" };
  }
}

export async function setCustomScheduleAction(
  employeeId: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    await setCustomSchedule(session.tenantId, employeeId, enabled);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update schedule" };
  }
}

export async function toggleWeekdayOffAction(
  employeeId: string,
  year: number,
  month: number,
  weekday: number
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    assertAdmin(session.role);
    const { off } = await toggleWeekdayOff(session.tenantId, employeeId, year, month, weekday);
    revalidatePath("/settings");
    return { ok: true, off };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to apply weekly off" };
  }
}