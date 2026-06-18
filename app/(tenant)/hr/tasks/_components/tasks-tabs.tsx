"use client";

// Tabbed task table — slices the in-scope tasks into the spec's five views
// (§7.1) and renders the full DataTable per tab. Used on the Tasks dashboard.

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TasksTable, type TaskRow } from "./tasks-table";

type EmployeeOption = { id: string; fullName: string; empCode: string };
type GoalOption = { id: string; title: string; employeeName: string };

/** Today's local calendar date as "YYYY-MM-DD". */
function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type Buckets = {
  today: TaskRow[];
  overdue: TaskRow[];
  inProgress: TaskRow[];
  upcoming: TaskRow[];
  completed: TaskRow[];
};

function bucketize(rows: TaskRow[]): Buckets {
  // Compare calendar-date STRINGS ("YYYY-MM-DD"), never epoch math: the due date
  // is stored at UTC midnight, so turning it into a local epoch shifts it by the
  // timezone offset and (for UTC+ users like BDT) pushes "today" into "upcoming".
  // String compare of the date part is timezone-proof and chronological.
  const today = todayKey();
  const FAR = "9999-99-99"; // null due date sorts as "no deadline" → upcoming
  const dayKey = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
  const isOpen = (r: TaskRow) => r.status !== "done" && r.status !== "cancelled";

  return {
    today: rows.filter((r) => isOpen(r) && dayKey(r.dueDate) === today),
    overdue: rows.filter((r) => isOpen(r) && (dayKey(r.dueDate) ?? FAR) < today),
    inProgress: rows.filter(
      (r) => r.status === "in_progress" || r.status === "blocked" || r.status === "submitted"
    ),
    upcoming: rows.filter((r) => isOpen(r) && (dayKey(r.dueDate) ?? FAR) > today),
    completed: rows.filter((r) => r.status === "done"),
  };
}

export function TasksTabs({
  rows,
  employees = [],
  goals = [],
  isAdmin = false,
  canAssign = false,
  currentEmployeeId = null,
}: {
  rows: TaskRow[];
  employees?: EmployeeOption[];
  goals?: GoalOption[];
  isAdmin?: boolean;
  canAssign?: boolean;
  currentEmployeeId?: string | null;
}) {
  const b = bucketize(rows);
  const tabs: { key: keyof Buckets; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "overdue", label: "Overdue" },
    { key: "inProgress", label: "In Progress" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <Tabs defaultValue="today">
      <TabsList className="flex-wrap">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-[10px]">{b[t.key].length}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key} className="mt-4">
          <TasksTable
            rows={b[t.key]}
            employees={employees}
            goals={goals}
            isAdmin={isAdmin}
            canAssign={canAssign}
            currentEmployeeId={currentEmployeeId}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}