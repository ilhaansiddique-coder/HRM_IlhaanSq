# Task Management Module — Design & Business Logic

> Module slug: **`tasks`** · Route root: **`/hr/tasks`** · Service dir: **`lib/services/hr/`**
> Follows existing conventions: tenant-scoped Prisma, `requireTenant()` server actions, `DataTable`, flat HR sidebar.

---

## 1. What we are building

A task & habit tracking system woven into the existing HR module, so a tenant (company) can:

| Capability | Who uses it | Where |
|---|---|---|
| **Assign tasks** to employees | Admin / Manager | `/hr/tasks` (board + table) |
| **My task list** (personal queue) | Every employee | `/hr/tasks/mine` |
| **Habits / daily checkmarks** | Every employee | `/hr/tasks/habits` |
| **Daily tracking** (what got done today) | Employee + Manager | `/hr/tasks` "Today" view |
| **History** (which task on which day) | Manager / Admin | `/hr/tasks/history` |
| **Monthly activity report** | Admin / Manager | `/hr/tasks/reports` |
| **Dashboard & analytics** | Admin / Manager | `/hr/tasks` overview cards |

Two distinct primitives, deliberately kept separate:

- **Task** — a one-off unit of work with a due date, owner, status, priority. Has a lifecycle (`todo → in_progress → done`). This covers "employee task assignment", "individual task list", "user↔task connection".
- **Habit** — a *recurring* commitment (e.g. "Submit daily sales report", "Gym", "Inbox zero") that produces a **checkmark per day**. This covers "habit/checkmark system" and "daily tracking". Habits never "complete"; they accumulate a streak.

Everything an employee does to a task or habit is written to a **TaskActivity** log, which is the single source of truth for "history" and "monthly reports".

---

## 2. Data model (Prisma)

All models follow house style: `id` uuid → `tenantId` uuid (`@map("tenant_id")`) → FKs → fields → `createdAt`/`updatedAt`, `@@index([tenantId, …])`, `@@map("snake_case")`, `onDelete: Cascade` to Tenant.

### 2.1 Enums

```prisma
enum TaskStatus {
  todo
  in_progress
  blocked
  done
  cancelled
}

enum TaskPriority {
  low
  medium
  high
  urgent
}

enum HabitFrequency {
  daily
  weekly          // due on specific weekdays
  monthly         // due N times per month
}

enum TaskActivityType {
  created
  assigned
  status_changed
  completed
  reopened
  commented
  habit_checked   // a habit checkmark for a given day
  habit_unchecked
}
```

### 2.2 Project / TaskList (optional grouping — Phase 2)

A lightweight bucket so tasks can be grouped by initiative ("Q3 Onboarding", "Warehouse move"). Keep optional; a task with `projectId = null` is a loose task.

```prisma
model TaskProject {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  name        String
  description String?
  color       String?                          // hex for board column tint
  archivedAt  DateTime? @map("archived_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tasks  Task[]

  @@index([tenantId])
  @@map("task_projects")
}
```

### 2.3 Task (core)

```prisma
model Task {
  id           String       @id @default(uuid()) @db.Uuid
  tenantId     String       @map("tenant_id") @db.Uuid
  projectId    String?      @map("project_id") @db.Uuid
  assigneeId   String?      @map("assignee_id") @db.Uuid     // Employee who DOES it
  createdById  String?      @map("created_by_id") @db.Uuid   // Employee/admin who assigned it
  title        String
  description  String?
  status       TaskStatus   @default(todo)
  priority     TaskPriority @default(medium)
  dueDate      DateTime?    @map("due_date") @db.Date
  startDate    DateTime?    @map("start_date") @db.Date
  completedAt  DateTime?    @map("completed_at")             // set when status→done
  estimateMins Int?         @map("estimate_mins")            // optional effort
  position     Int          @default(0)                      // board ordering within a status column
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  tenant     Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  project    TaskProject?   @relation(fields: [projectId], references: [id], onDelete: SetNull)
  assignee   Employee?      @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  activities TaskActivity[]

  @@index([tenantId, assigneeId])
  @@index([tenantId, status])
  @@index([tenantId, dueDate])
  @@map("tasks")
}
```

### 2.4 Habit + HabitEntry (the checkmark system)

A **Habit** is the definition. A **HabitEntry** is one checkmark for one calendar day. We store entries (not just a streak counter) because the user explicitly wants *history* — "which day did X happen".

```prisma
model Habit {
  id          String         @id @default(uuid()) @db.Uuid
  tenantId    String         @map("tenant_id") @db.Uuid
  employeeId  String         @map("employee_id") @db.Uuid    // habit belongs to ONE person
  title       String
  description String?
  frequency   HabitFrequency @default(daily)
  // for weekly: bitmask/array of weekdays it's due; for monthly: target count
  weekdays    Int[]          @default([])                    // 0=Sun..6=Sat (weekly)
  targetPerMonth Int?        @map("target_per_month")        // monthly goal
  color       String?
  icon        String?                                        // lucide icon name
  isActive    Boolean        @default(true) @map("is_active")
  archivedAt  DateTime?      @map("archived_at")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  tenant   Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  employee Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  entries  HabitEntry[]

  @@index([tenantId, employeeId])
  @@map("habits")
}

model HabitEntry {
  id         String   @id @default(uuid()) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  habitId    String   @map("habit_id") @db.Uuid
  employeeId String   @map("employee_id") @db.Uuid
  date       DateTime @db.Date                                // the day this checkmark is for
  done       Boolean  @default(true)
  note       String?
  createdAt  DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  habit  Habit  @relation(fields: [habitId], references: [id], onDelete: Cascade)

  @@unique([habitId, date])                                  // one checkmark per habit per day
  @@index([tenantId, employeeId, date])
  @@map("habit_entries")
}
```

> **Why `@@unique([habitId, date])`** — toggling a checkmark is an idempotent upsert keyed on (habit, day). Re-checking the same day never creates a duplicate; un-checking deletes the row (or flips `done=false`). This is what makes the calendar grid and streak math trivial.

### 2.5 TaskActivity (history + report source)

Every meaningful change appends one row. This table is **append-only** and powers both the History page and the Monthly Report — never recomputed from task state, so it's an accurate audit trail even after a task is deleted-by-cascade is avoided (we keep `taskId` nullable so history survives task deletion if desired; for now Cascade).

```prisma
model TaskActivity {
  id         String           @id @default(uuid()) @db.Uuid
  tenantId   String           @map("tenant_id") @db.Uuid
  employeeId String?          @map("employee_id") @db.Uuid   // who the activity is attributed to
  actorId    String?          @map("actor_id") @db.Uuid      // who performed it (manager vs self)
  taskId     String?          @map("task_id") @db.Uuid
  habitId    String?          @map("habit_id") @db.Uuid
  type       TaskActivityType
  fromStatus TaskStatus?      @map("from_status")
  toStatus   TaskStatus?      @map("to_status")
  detail     String?                                         // free text / comment body
  occurredOn DateTime         @map("occurred_on") @db.Date   // the DAY it counts for (report bucket)
  createdAt  DateTime         @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  task   Task?  @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([tenantId, employeeId, occurredOn])
  @@index([tenantId, occurredOn])
  @@map("task_activities")
}
```

### 2.6 Relations to add on existing models

```prisma
// model Employee { ... add:
  tasksAssigned  Task[]         @relation("TaskAssignee")
  habits         Habit[]
// }

// model Tenant { ... add back-relations:
  taskProjects   TaskProject[]
  tasks          Task[]
  habits         Habit[]
  habitEntries   HabitEntry[]
  taskActivities TaskActivity[]
// }
```

---

## 3. Business logic / rules

### 3.1 Task lifecycle

```
        assign / create
            │
            ▼
        ┌────────┐  start   ┌─────────────┐  finish  ┌────────┐
        │  todo  │ ───────► │ in_progress │ ───────► │  done  │
        └────────┘          └─────────────┘          └────────┘
            ▲                     │  block                │ reopen
            │                     ▼                       │
            │                 ┌─────────┐                 │
            └──── reopen ──────│ blocked │◄────────────────┘
                              └─────────┘
   any state ──cancel──► cancelled (terminal, excluded from reports)
```

Rules enforced in the service layer:

1. **`status → done`** sets `completedAt = now()` and appends `TaskActivity{type: completed, occurredOn: today}`. Clearing `done` clears `completedAt` and logs `reopened`.
2. **Reassignment** (`assigneeId` change) logs `assigned` with `detail = "→ <new name>"`. Only Admin/Manager may reassign; an employee can only act on tasks where `assigneeId == self`.
3. **Overdue** is *derived*, never stored: `status ∉ {done,cancelled} && dueDate < today`. Surfaced as a red badge + a dashboard counter.
4. **`cancelled`** tasks are excluded from completion-rate analytics but remain in raw history.
5. **Board position** — drag-drop within a column reorders `position`; moving across columns also flips `status` (and logs `status_changed`).

### 3.2 Habit / checkmark logic

1. **Toggle = upsert** on `(habitId, date)`. Checking today:
   - upsert `HabitEntry{done:true}`,
   - append `TaskActivity{type: habit_checked, occurredOn: date}`.
   Unchecking deletes the entry + logs `habit_unchecked`.
2. **Who can check** — only the habit's owner (`employeeId == self`), or an Admin on their behalf (logged with `actorId != employeeId`).
3. **Streak** (current) = count back from today while consecutive *due* days each have `done=true`. "Due day" depends on `frequency`:
   - `daily` → every day is due,
   - `weekly` → only days whose weekday ∈ `weekdays`,
   - `monthly` → not a streak; measured as `done count / targetPerMonth` within the month.
4. **Completion % for a period** = `done entries / due days in period`. This is the headline number on the dashboard and monthly report.
5. **Back-dating** — an employee may tick *yesterday* but not future dates (`date <= today` guard). Admin may back-date further (configurable later).

### 3.3 Daily tracking ("Today")

The default `/hr/tasks` tab for an employee answers *"what do I do today and what have I done"*:

- **Due/overdue tasks** assigned to me (status ≠ done).
- **Today's habits** as a checkmark row (tap to toggle).
- A live "X of Y done today" progress ring fed by `TaskActivity` where `occurredOn = today && employeeId = self`.

### 3.4 Monthly activity report

Pure aggregation over `TaskActivity` for a `[monthStart, monthEnd]` window, grouped by employee:

| Metric | Query |
|---|---|
| Tasks completed | `count(type=completed)` |
| Tasks assigned to them | `count(distinct taskId where type∈{created,assigned})` |
| Habit check-ins | `count(type=habit_checked)` |
| Habit completion % | `habit_checked / due-days-across-active-habits` |
| Active days | `count(distinct occurredOn)` |
| Best streak | derived per habit |

Output: per-employee table + a **calendar heatmap** (GitHub-style) where each day's intensity = activity count that day, sourced from `groupBy(occurredOn)`. This is the "which day, which task" view rendered visually.

### 3.5 Permissions matrix

| Action | Employee (self) | Manager | Admin |
|---|---|---|---|
| Create task for self | ✅ | ✅ | ✅ |
| Assign task to others | ❌ | ✅ (their reports) | ✅ (anyone) |
| Change status of own task | ✅ | ✅ | ✅ |
| Change status of others' task | ❌ | ✅ | ✅ |
| Create/own habits | ✅ (own only) | ✅ | ✅ |
| Check another person's habit | ❌ | ❌ | ✅ |
| View team reports / history | ❌ (self only) | ✅ (reports) | ✅ (all) |
| Manage projects | ❌ | ✅ | ✅ |

Enforced via the existing `requireTenant()` + role check (`session.role`, `session.isSuperAdmin`) and a per-record `assertCanActOn(session, task)` guard in the service, mirroring how Leave approvals gate by role.

---

## 4. Service layer (`lib/services/hr/task.service.ts`)

Signatures (tenantId-first, returns plain objects, throws on violation — same as `leave.service.ts`):

```ts
// Projects
listProjects(tenantId)
createProject(tenantId, { name, description?, color? })
archiveProject(tenantId, id)

// Tasks
listTasks(tenantId, filter: { assigneeId?, status?, projectId?, dueBefore?, q? })
getTask(tenantId, id)
createTask(tenantId, input, actor: { employeeId, role })
updateTask(tenantId, id, patch, actor)
setTaskStatus(tenantId, id, status, actor)        // handles completedAt + activity log
reassignTask(tenantId, id, assigneeId, actor)
reorderTask(tenantId, id, status, position, actor)
deleteTasks(tenantId, ids[], actor)

// Habits
listHabits(tenantId, employeeId)
createHabit(tenantId, input)
updateHabit(tenantId, id, patch)
archiveHabit(tenantId, id)
toggleHabitEntry(tenantId, habitId, date, actor)  // upsert/delete + activity log
getHabitMatrix(tenantId, employeeId, monthStart)  // 1 habit × N days grid for the UI
computeStreak(tenantId, habitId)

// Tracking & analytics
getTodayBoard(tenantId, employeeId)               // due tasks + today's habits + progress
getActivityHistory(tenantId, filter)              // paginated TaskActivity for History page
getMonthlyReport(tenantId, { year, month, employeeId? })
getDashboardStats(tenantId, scope)                // cards: open, overdue, done this week, top streaks
getHeatmap(tenantId, employeeId, fromDate, toDate)
```

A small `_shared` helper `assertCanActOn(session, record)` centralises the permission matrix.

---

## 5. Server actions (`app/(tenant)/hr/tasks/actions.ts`)

All `"use server"`, all start with `const session = await requireTenant();`, parse `FormData`, call the service with `session.tenantId` + actor, `revalidatePath("/hr/tasks")`, return `{ ok, error? }`. Mirrors `app/(tenant)/hr/actions.ts` exactly. Key actions:

`createTaskAction`, `updateTaskAction`, `setTaskStatusAction`, `reassignTaskAction`, `reorderTaskAction`, `deleteTasksAction`, `createHabitAction`, `toggleHabitAction`, `createProjectAction`.

`toggleHabitAction` is the hot path (one call per checkmark) — keep it lean and return the new streak so the UI updates the badge without a full refetch.

---

## 6. Routes & UI

```
app/(tenant)/hr/tasks/
  page.tsx                 → Dashboard + "Today" board (overview cards, my due tasks, habit row)
  actions.ts
  _components/
    task-board.tsx         → Kanban (todo/in_progress/blocked/done columns, drag-drop)
    new-task-dialog.tsx    → 1150×830 dialog, CheckSquare icon (matches house dialog style)
    task-row.tsx
    habit-strip.tsx        → today's habits as toggleable pills
  mine/page.tsx            → personal task list (DataTable, filter by status)
  board/page.tsx           → full Kanban for managers (all employees / by project)
  habits/
    page.tsx               → habit list + monthly calendar grid of checkmarks
    _components/habit-calendar.tsx
    new-habit-dialog.tsx
  history/page.tsx         → TaskActivity feed (DataTable, filter by employee/date range)
  reports/page.tsx         → monthly report table + GitHub-style heatmap
```

- **Tables** use the shared `DataTable<Row>` (`components/ui/data-table.tsx`) — same `Column[]` + `actionsCell` pattern as `attendance-records-table.tsx`.
- **Dialogs** use the global 1150×830 shell with a heading icon (`CheckSquare` for tasks, `Repeat` for habits) — consistent with every other dialog you've polished.
- **Date filtering** (History, Reports) reuses your existing `DateRangePicker` + `lib/date-range.ts` (`resolveDateBounds`). Add `/hr/tasks/history` and `/hr/tasks/reports` to `DATE_FILTER_PATHS`.

### 6.1 Sidebar

Add to the flat HR menu array in `tenant-shell.tsx`:

```ts
{ href: "/hr/tasks", icon: CheckSquare, label: "Tasks", active: isRouteActive("/hr/tasks") },
```

Split-dropdown (chevron toggles, name navigates) with children **My Tasks**, **Board**, **Habits**, **History**, **Reports** — same pattern you used for Performance/Recruitment/Learning.

---

## 7. Analytics & dashboard cards

Overview cards on `/hr/tasks` (admin scope = whole tenant, employee scope = self):

1. **Open tasks** (`status ∈ {todo,in_progress,blocked}`)
2. **Overdue** (red) — derived
3. **Completed this week** (`type=completed`, last 7 days)
4. **Habit completion %** (this month)
5. **Top streaks** — leaderboard of longest current habit streaks
6. **Activity heatmap** — last 90 days, intensity by `occurredOn` count

All come from indexed queries on `TaskActivity` (`@@index([tenantId, occurredOn])`, `@@index([tenantId, employeeId, occurredOn])`) — no full scans.

---

## 8. Phased rollout

| Phase | Scope | Deliverable |
|---|---|---|
| **1 — Core tasks** | `Task` + `TaskActivity` models, service, actions, `/hr/tasks` list + `new-task-dialog`, sidebar entry | Assign & track one-off tasks end-to-end |
| **2 — Habits** | `Habit` + `HabitEntry`, toggle action, `/hr/tasks/habits` calendar grid, "Today" habit strip | Daily checkmark system + streaks |
| **3 — Board** | Kanban drag-drop (`position`, `reorderTask`), `TaskProject` grouping | Visual workflow |
| **4 — Reports & analytics** | `getMonthlyReport`, `/hr/tasks/reports`, heatmap, dashboard cards, History page | Monthly activity report + history |
| **5 — Polish** | Notifications (reuse existing `Notification` model) on assignment/overdue, employee-self-view confinement, CSV export | Production hardening |

Each phase is independently shippable and tsc-clean before moving on.

---

## 9. Decisions (locked 2026-06-17)

1. **Manager scope** → **Admin vs Employee** for now. (`Employee.managerId` already exists in the schema, so a manager-scoped view can be layered in later without migration.)
2. **Tasks for self** → **Yes** — employees create their own ad-hoc tasks *and* receive assigned ones. Non-admins are force-scoped to their own `assigneeId`.
3. **Habits** → **Personal + company templates.** Phase 2 adds a `scope` (`personal | company`) to `Habit`; a company habit has `employeeId = null` and applies to all active employees, with `HabitEntry` still keyed per employee.
4. **Projects** → **Deferred to Phase 3.** `Task.projectId` stays null until then.

## 10. Build status

- **Phase 1 — Core tasks: ✅ shipped.** `Task` + `TaskActivity` tables (applied via `prisma/sql/_task_management.sql`), `lib/services/hr/task.service.ts`, `app/(tenant)/hr/tasks/{actions.ts,page.tsx}`, `new-task-dialog` + `tasks-table`, sidebar **Tasks** entry. tsc clean. Employees see only their own tasks; admins see/assign all; status changes + completion logged to `TaskActivity`.
- Phases 2–5 pending (Habits → Board → Reports → Polish).

> **Migration note:** the tasks tables were applied with direct additive SQL (`prisma db execute`) rather than `migrate dev`, because (a) an older migration (`PayrollColumnGroup` enum) fails shadow-DB validation, and (b) `db push` wanted to drop unrelated legacy `business_settings` columns that still hold data. The SQL matches Prisma's generated naming so there is no drift for these tables.

---

## 11. Performance Integration (authoritative plan)

The Performance module (Goals / Cycles / Reviews) today is a **manual appraisal form** — `Goal.progress` is typed in, `Review.overallRating` is a subjective 1–5, closing a cycle does nothing, and `Goal.weight` / `parentGoalId` / `Employee.managerId` are dormant. The Task module's `TaskActivity` event log is the objective fuel it never had. This section is the authoritative plan to bridge them: **operational facts (tasks/habits) roll *up* into strategic appraisal (goals/cycles/reviews) — one direction only. Appraisal never writes back down into tasks.**

### 11.1 The four links

```
 Habits ──┐
 Tasks ───┼──► TaskActivity (event log = source of truth)
 Checklist│              │
 progress%│              ▼
          │     PRODUCTIVITY ENGINE  (per employee, per period)
          │     TaskCompletion% · HabitCompliance% · OnTime% · ActiveDays
          │              │
   Task.goalId ──────────┼──────► GOAL auto-progress
          │              │        (linked tasks done → goal % advances)
          │              │              │
   Cycle date-window ────┼──────► CYCLE close snapshots score + goal
          │              │              │   achievement per employee
          │              ▼              ▼
          └────► EMPLOYEE PERFORMANCE SUMMARY ──► REVIEW
                 (objective metrics pre-filled,    (manager adds the
                  manager dashboard)                subjective rating)
```

| # | Link | Mechanism | Rule |
|---|---|---|---|
| **1** | **Task → Goal** | optional `Task.goalId` FK | A task may be tied to one OKR/KPI. Optional — most daily tasks have no goal; the score still captures them. |
| **2** | **Half-done counts** | `Task.progressPct` (from checklist) | A task at 7/12 items = 58% contributes *partially*. "Complete / done / half-done" becomes a number, not a guess. This is why checklists are prerequisite. |
| **3** | **Cycle → window** | `ReviewCycle.startDate..endDate` | Closing a cycle runs the engine for that window and **snapshots** each employee's score + goal achievement (gives "close cycle" a purpose). |
| **4** | **Score → Review** | engine output prefills the review | Manager opens a review pre-filled with completion %, habit compliance, on-time, active days, productivity score. Judgment on top of facts; always overridable. |

### 11.2 Goal auto-progress rollup

When a goal has linked tasks, its progress is **derived**, not typed:

```
GoalProgress = round( mean(progressPct) over linked tasks where status ≠ cancelled )
```

- Recomputed on every linked-task event (create / delete / status change / checklist toggle).
- Status auto-transitions reuse the existing rule: `≥100 → achieved`, `>0 → in_progress`.
- **Hybrid:** a goal with **no** linked tasks keeps today's manual `currentValue/targetValue` entry. A goal with linked tasks shows "auto" and disables manual entry (with an admin override escape hatch). We never remove manual goals.

### 11.3 Productivity score (spec §12, made concrete)

```
Score = 0.40·TaskCompletion + 0.30·HabitCompliance + 0.15·ActiveDaysRatio + 0.15·OnTimeRatio
```

Each sub-metric is 0–100 over the period. **Until Habits ship, weights re-normalise** across the available metrics (so a tasks-only score is still valid), then snap to the full formula once habit data exists. Weights become admin-configurable later (repurposing the dormant weight fields).

### 11.4 Schema deltas

```prisma
// NEW — checklist sub-items (the progress-% source)
model ChecklistItem {
  id          String    @id @default(uuid()) @db.Uuid
  tenantId    String    @map("tenant_id") @db.Uuid
  taskId      String    @map("task_id") @db.Uuid
  label       String
  isChecked   Boolean   @default(false) @map("is_checked")
  position    Int       @default(0)
  checkedAt   DateTime? @map("checked_at")
  checkedById String?   @map("checked_by_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([tenantId, taskId])
  @@map("checklist_items")
}

// Task — add:
  progressPct Int             @default(0) @map("progress_pct")  // derived; see §6 / 11.2
  goalId      String?         @map("goal_id") @db.Uuid           // optional bridge to a Goal
  checklist   ChecklistItem[]
  goal        Goal?           @relation(fields: [goalId], references: [id], onDelete: SetNull)

// Goal — add back-relation:
  tasks       Task[]

// Tenant — add back-relation:
  checklistItems ChecklistItem[]
```

> `checklist.item_checked` events are written to the existing `TaskActivity` log (the audit trail the spec §10 requires), reusing `TaskActivityType` — add a `checklist_checked` / `checklist_unchecked` member when implemented.

### 11.5 Integration phasing (supersedes §8 ordering)

| Phase | Delivers | Status |
|---|---|---|
| **2a — Checklists + progress %** | sub-items, live `progressPct`, "half-done" as a number (spec §6) | ✅ shipped |
| **2b — Task → Goal bridge** | `Task.goalId`, goal auto-progress rollup, surfaced on Performance overview | ✅ shipped |
| **Edit / reassign / delete UI** | full edit dialog (title/priority/dates/goal/assignee), single delete | ✅ shipped |
| **3 — Habits** | `Habit` + `HabitEntry` (personal + company scope), check-ins, streaks, compliance %, monthly calendar grid + Today strip; folds into the score (full §12.2 formula) | ✅ shipped |
| **4 — Productivity engine + Reports** | `getEmployeePerformance` / `getTeamPerformance` / `getMonthlyReport`; "Productivity this month" on the dashboard + a full Reports page (today/week/month % + habit + on-time + score, §11.4/§12) | ✅ shipped |
| **Comments** | per-task comment thread in the detail dialog; `commented` events logged | ✅ shipped |
| **My Tasks views** | `/hr/tasks/mine` with Today / Overdue / In Progress / Upcoming / Completed tabs (§7.1) | ✅ shipped |
| **History page** | `/hr/tasks/history` activity feed over `TaskActivity` (admin: all; employee: own) | ✅ shipped |
| **Sidebar submenu** | Tasks split-dropdown (My Tasks / Habits / History / Reports); employee nav gets Tasks + Habits | ✅ shipped |
| **Notifications** | Task/Habit/Comment creates flow to the notification center; per-tick sub-tables denylisted to avoid spam | ✅ shipped |
| **6 — Manager/team view** | `resolveScope` tier (full/team/self); managers see + assign + reassign + delete within their direct reports (`Employee.managerId`); dashboard, History and Reports all team-scoped; ranked team productivity. = spec Manager role | ✅ shipped |
| **5 — Cycle snapshot + Review prefill** | `PerformanceReport` cache on cycle close; review form pre-filled | pending |
| **Kanban board** | drag-drop columns (`position`, `reorderTask`) | pending |
| **Working-day calendar** | admin-configurable working days (active-days/habit math currently uses calendar days) | pending |

### 11.6 Guardrails

- **One direction.** Tasks/habits → goals/reviews. Never reverse.
- **Optional linkage.** `Task.goalId` nullable; daily work is never forced into an OKR.
- **Decision support, not verdict.** Every score drills back to its `TaskActivity` events (spec acceptance criterion); a human reviewer always overrides.
- **`done` vs `completed`:** internal enum value stays `done`; UI labels it "Completed" to match the spec wording. No destructive enum rename.
