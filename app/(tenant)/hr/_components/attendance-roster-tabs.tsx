"use client";

// Tabbed version of the "Attendance Today" roster. Each status (Present / Late
// / On Leave / Absent) is a clickable tab; selecting one shows just that
// group's employees. Replaces the old stacked-list layout.
//
// Note: a "late" employee is still physically PRESENT (they just checked in
// late), so they appear under BOTH the Present tab (flagged "Late") and the
// dedicated Late tab.

import { useState } from "react";

type Tone = "success" | "warning" | "destructive" | "info";

type RosterMember = {
  id: string;
  fullName: string;
  empCode: string;
  department: string | null;
  detail: string | null;
};

// A member as rendered in a tab — `late` marks an on-time-vs-late distinction
// used only inside the Present tab.
type TabMember = RosterMember & { late?: boolean };

const TONE_DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-primary",
};

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-primary",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "—";
}

export function AttendanceRosterTabs({
  present,
  late,
  onLeave,
  absent,
}: {
  present: RosterMember[];
  late: RosterMember[];
  onLeave: RosterMember[];
  absent: RosterMember[];
}) {
  // Present = on-time present + late (late employees are present, just late).
  // On-time first, then the late arrivals, each tagged so the UI can badge them.
  const presentAll: TabMember[] = [
    ...present.map((m) => ({ ...m, late: false })),
    ...late.map((m) => ({ ...m, late: true })),
  ];

  const tabs: { key: string; label: string; tone: Tone; members: TabMember[] }[] = [
    { key: "present", label: "Present", tone: "success", members: presentAll },
    { key: "late", label: "Late", tone: "warning", members: late },
    { key: "onLeave", label: "On Leave", tone: "info", members: onLeave },
    { key: "absent", label: "Absent", tone: "destructive", members: absent },
  ];

  // Default to the first tab that actually has people in it.
  const firstWithMembers = tabs.find((t) => t.members.length > 0)?.key ?? "present";
  const [active, setActive] = useState(firstWithMembers);

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:bg-background/70"
              }`}
              aria-pressed={isActive}
            >
              <span className={`h-2 w-2 rounded-full ${TONE_DOT[t.tone]}`} />
              {t.label}
              <span
                className={`rounded-full px-1.5 text-[11px] font-medium ${
                  isActive ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {t.members.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected group's members */}
      {current.members.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No employees{" "}
          <span className={TONE_TEXT[current.tone]}>{current.label.toLowerCase()}</span>{" "}
          today.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {current.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                {initials(m.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">
                  {m.fullName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {m.empCode}
                  {m.department ? ` · ${m.department}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {/* In the Present tab, mark the ones who arrived late. */}
                {m.late && (
                  <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                    Late
                  </span>
                )}
                {m.detail && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {m.detail}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
