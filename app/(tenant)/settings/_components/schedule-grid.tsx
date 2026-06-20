"use client";

// Monthly per-employee off-day grid + lunch windows (Settings → Off Days & Lunch).
// Desktop (lg+): a table whose left cluster (Employee · Custom · Lunch · Weekly off)
// is frozen/sticky while the date columns scroll. Mobile + tablet (< lg): one
// calendar CARD per employee. Click a date to toggle off; click a red OFF to decline.

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import type { ScheduleMonth } from "@/lib/services/hr/schedule.service";
import {
  toggleOffDayAction,
  toggleWeekdayOffAction,
  setLunchAction,
  setCustomScheduleAction,
  getScheduleMonthAction,
} from "../schedule-actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WD = ["S", "M", "T", "W", "T", "F", "S"]; // 0=Sun … 6=Sat
const WD_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function iso(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}
function weekdayOf(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

type EmpRow = ScheduleMonth["employees"][number];

export function ScheduleGrid({ initial }: { initial: ScheduleMonth | null }) {
  const [data, setData] = useState<ScheduleMonth | null>(initial);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Unable to load schedules.</p>;
  }

  const { year, month, daysInMonth, weekendDays, holidays } = data;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const holidayMap = new Map(holidays.map((h) => [h.dateISO, h]));

  async function reload(y: number, m: number) {
    setBusy(true);
    setError(null);
    const next = await getScheduleMonthAction(y, m);
    setBusy(false);
    if (next) setData(next);
    else setError("Could not load that month.");
  }

  function gotoMonth(delta: number) {
    let y = year;
    let m = month + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    startTransition(() => reload(y, m));
  }

  function patchRow(employeeId: string, fn: (r: EmpRow) => EmpRow) {
    setData((d) =>
      d ? { ...d, employees: d.employees.map((e) => (e.employeeId === employeeId ? fn(e) : e)) } : d
    );
  }

  function toggleCell(employeeId: string, day: number) {
    const dateISO = iso(year, month, day);
    const row = data!.employees.find((e) => e.employeeId === employeeId);
    if (!row) return;
    const wasOff = row.offDates.includes(dateISO);
    // Declining (removing) an off day is ALWAYS allowed (emergency / mistake);
    // adding a brand-new off day requires the employee to be on a Custom schedule.
    if (!wasOff && !row.usesCustomSchedule) return;
    patchRow(employeeId, (r) => ({
      ...r,
      offDates: wasOff ? r.offDates.filter((x) => x !== dateISO) : [...r.offDates, dateISO],
    }));
    startTransition(async () => {
      const res = await toggleOffDayAction(employeeId, dateISO);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        patchRow(employeeId, (r) => ({
          ...r,
          offDates: wasOff ? [...r.offDates, dateISO] : r.offDates.filter((x) => x !== dateISO),
        }));
      }
    });
  }

  function toggleWeekday(employeeId: string, weekday: number) {
    startTransition(async () => {
      const res = await toggleWeekdayOffAction(employeeId, year, month, weekday);
      if (!res.ok) setError(res.error ?? "Failed");
      else await reload(year, month);
    });
  }

  function toggleCustom(employeeId: string, enabled: boolean) {
    patchRow(employeeId, (r) => ({ ...r, usesCustomSchedule: enabled }));
    startTransition(async () => {
      const res = await setCustomScheduleAction(employeeId, enabled);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        patchRow(employeeId, (r) => ({ ...r, usesCustomSchedule: !enabled }));
      }
    });
  }

  function saveLunch(employeeId: string, start: string, end: string) {
    // Optimistic so the controlled TimePicker reflects the new value at once.
    patchRow(employeeId, (r) => ({ ...r, lunchStart: start || null, lunchEnd: end || null }));
    startTransition(async () => {
      const res = await setLunchAction(employeeId, start, end);
      if (!res.ok) setError(res.error ?? "Failed");
    });
  }

  // ── shared field renderers (used by both table cells and cards) ──
  const CustomToggle = (e: EmpRow) => (
    <button
      type="button"
      role="switch"
      aria-checked={e.usesCustomSchedule}
      onClick={() => toggleCustom(e.employeeId, !e.usesCustomSchedule)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        e.usesCustomSchedule ? "bg-primary" : "bg-muted-foreground/30"
      )}
      title={e.usesCustomSchedule ? "Custom schedule on" : "Follows company weekend"}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          e.usesCustomSchedule ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );

  const LunchFields = (e: EmpRow) => (
    <div className="flex items-center gap-1.5">
      <TimePicker
        value={e.lunchStart ?? ""}
        onChange={(v) => saveLunch(e.employeeId, v, e.lunchEnd ?? "")}
        placeholder="Start"
        minuteStep={5}
        className="h-7 w-[94px] gap-1.5 rounded-full px-2.5 text-[11px] font-medium"
      />
      <span className="text-muted-foreground">–</span>
      <TimePicker
        value={e.lunchEnd ?? ""}
        onChange={(v) => saveLunch(e.employeeId, e.lunchStart ?? "", v)}
        placeholder="End"
        minuteStep={5}
        className="h-7 w-[94px] gap-1.5 rounded-full px-2.5 text-[11px] font-medium"
      />
    </div>
  );

  const WeeklyOffLetters = (e: EmpRow, offSet: Set<string>) => (
    <div className="flex items-center gap-0.5">
      {WD.map((label, wd) => {
        const occ = days.filter((d) => weekdayOf(year, month, d) === wd);
        const allOff = occ.length > 0 && occ.every((d) => offSet.has(iso(year, month, d)));
        return (
          <button
            key={wd}
            type="button"
            disabled={!e.usesCustomSchedule || pending}
            onClick={() => toggleWeekday(e.employeeId, wd)}
            className={cn(
              "h-5 w-5 rounded text-[10px] font-semibold transition-colors disabled:opacity-30",
              allOff
                ? "bg-destructive text-destructive-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
            )}
            title={`Toggle all ${WD_FULL[wd]}s off`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  /** One date button — shared by table cells and the mobile card calendar. */
  const DayButton = (e: EmpRow, d: number, offSet: Set<string>, big = false) => {
    const dISO = iso(year, month, d);
    const isOff = offSet.has(dISO);
    const custom = e.usesCustomSchedule;
    const hol = holidayMap.get(dISO);
    return (
      <button
        type="button"
        disabled={pending || (!isOff && !custom)}
        onClick={() => toggleCell(e.employeeId, d)}
        className={cn(
          "group/cell font-semibold transition-colors",
          big ? "flex h-9 w-full items-center justify-center rounded-md text-[11px]" : "h-8 w-9 text-[10px]",
          !isOff && !custom && "cursor-not-allowed opacity-30",
          isOff
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/70"
            : custom
              ? "text-muted-foreground/50 hover:bg-primary/10"
              : "text-muted-foreground/40",
          big && !isOff && hol && "bg-amber-500/10",
          big && !isOff && !hol && weekendDays.includes(weekdayOf(year, month, d)) && "bg-muted/40"
        )}
        title={
          isOff
            ? `Off day — ${dISO}. Click to DECLINE (employee works this day).`
            : hol
              ? `Holiday available: ${hol.name}${hol.tentative ? " (tentative)" : ""} — apply from the Holidays list`
              : dISO
        }
      >
        {big ? (
          <span>{isOff ? "✕" : d}</span>
        ) : (
          <>
            <span className={isOff ? "group-hover/cell:hidden" : ""}>{isOff ? "OFF" : "·"}</span>
            {isOff && <span className="hidden group-hover/cell:inline">✕</span>}
          </>
        )}
      </button>
    );
  };

  const leadingBlanks = weekdayOf(year, month, 1); // empty cells before day 1

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CalendarDays className="h-5 w-5 text-primary" />
          Off Days &amp; Lunch — per employee
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn on <span className="font-medium text-foreground">Custom</span> for an employee, then click the dates they&apos;re
          off. Those off days replace the company weekend in attendance &amp; payroll. Use the weekday letters to mark every
          Friday (etc.) at once. To <span className="font-medium text-foreground">decline</span> any off day (emergency or
          mistake) click the red <span className="font-semibold text-destructive">OFF</span> — it&apos;s removed and the employee is back on duty.
        </p>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => gotoMonth(-1)}
          disabled={busy || pending}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/70 hover:bg-muted disabled:opacity-40"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[150px] text-center text-sm font-semibold">
          {MONTHS[month - 1]} {year}
        </span>
        <button
          type="button"
          onClick={() => gotoMonth(1)}
          disabled={busy || pending}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/70 hover:bg-muted disabled:opacity-40"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {(busy || pending) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {/* ── DESKTOP (lg+): table with frozen left cluster ── */}
      <div className="hidden overflow-x-auto rounded-xl border border-border/70 bg-card/60 lg:block">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-[var(--table-head)]">
              <th className="sticky left-0 z-20 w-[148px] min-w-[148px] max-w-[148px] bg-[var(--table-head)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Employee
              </th>
              <th className="sticky left-[148px] z-20 w-[56px] min-w-[56px] max-w-[56px] bg-[var(--table-head)] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Custom
              </th>
              <th className="sticky left-[204px] z-20 w-[230px] min-w-[230px] max-w-[230px] bg-[var(--table-head)] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lunch
              </th>
              <th className="sticky left-[434px] z-20 w-[170px] min-w-[170px] max-w-[170px] border-r-2 border-border bg-[var(--table-head)] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Weekly off
              </th>
              {days.map((d) => {
                const wknd = weekendDays.includes(weekdayOf(year, month, d));
                const hol = holidayMap.get(iso(year, month, d));
                return (
                  <th
                    key={d}
                    title={hol ? `${hol.name}${hol.tentative ? " (tentative)" : ""}` : undefined}
                    className={cn(
                      "w-9 px-0 py-1 text-center text-[10px] font-medium text-muted-foreground",
                      hol ? "bg-amber-500/20" : wknd && "bg-muted/40"
                    )}
                  >
                    <div className="leading-none">{d}</div>
                    <div className="text-[9px] opacity-60">{WD[weekdayOf(year, month, d)]}</div>
                    {hol && <div className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-amber-500" />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.employees.length === 0 ? (
              <tr>
                <td colSpan={4 + daysInMonth} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No active employees.
                </td>
              </tr>
            ) : (
              data.employees.map((e) => {
                const offSet = new Set(e.offDates);
                return (
                  <tr key={e.employeeId} className="border-t border-border/50">
                    <td className="sticky left-0 z-10 w-[148px] min-w-[148px] max-w-[148px] bg-card px-3 py-2">
                      <p className="truncate text-sm font-medium" title={e.fullName}>{e.fullName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        <span className="font-mono">{e.empCode}</span>
                        {e.department ? ` · ${e.department}` : ""}
                      </p>
                    </td>
                    <td className="sticky left-[148px] z-10 w-[56px] min-w-[56px] max-w-[56px] bg-card px-1 py-2 text-center">
                      {CustomToggle(e)}
                    </td>
                    <td className="sticky left-[204px] z-10 w-[230px] min-w-[230px] max-w-[230px] bg-card px-2 py-2">
                      <div className="flex justify-center">{LunchFields(e)}</div>
                    </td>
                    <td className="sticky left-[434px] z-10 w-[170px] min-w-[170px] max-w-[170px] border-r-2 border-border bg-card px-2 py-2">
                      <div className="flex justify-center">{WeeklyOffLetters(e, offSet)}</div>
                    </td>
                    {days.map((d) => {
                      const wknd = weekendDays.includes(weekdayOf(year, month, d));
                      const hol = holidayMap.get(iso(year, month, d));
                      return (
                        <td key={d} className={cn("p-0 text-center", hol ? "bg-amber-500/10" : wknd && "bg-muted/30")}>
                          {DayButton(e, d, offSet)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE + TABLET (< lg): one calendar card per employee ── */}
      <div className="space-y-3 lg:hidden">
        {data.employees.length === 0 ? (
          <p className="rounded-xl border border-border/70 bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            No active employees.
          </p>
        ) : (
          data.employees.map((e) => {
            const offSet = new Set(e.offDates);
            return (
              <div key={e.employeeId} className="rounded-xl border border-border/70 bg-card/70 p-3">
                {/* Header: name + custom toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={e.fullName}>{e.fullName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      <span className="font-mono">{e.empCode}</span>
                      {e.department ? ` · ${e.department}` : ""}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    Custom {CustomToggle(e)}
                  </label>
                </div>

                {/* Lunch + weekly off */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Lunch</p>
                    {LunchFields(e)}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Weekly off</p>
                    {WeeklyOffLetters(e, offSet)}
                  </div>
                </div>

                {/* Month calendar */}
                <div className="mt-3">
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
                    {WD.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
                    {days.map((d) => (
                      <div key={d}>{DayButton(e, d, offSet, true)}</div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="mr-1 inline-block h-3 w-3 translate-y-0.5 rounded bg-destructive" /> = off day (personal off, or a holiday you applied) ·
        <span className="mx-1 inline-block h-3 w-3 translate-y-0.5 rounded bg-amber-500/40" /> amber = a holiday is defined that day (apply it from the Holidays list) ·
        grey = the company weekend ({weekendDays.map((d) => WD_FULL[d]).join(", ") || "none"}).
      </p>
    </div>
  );
}