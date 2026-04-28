# HR Module — Complete Reference

> Tenant-scoped Human Resources platform built on Next.js App Router, server actions, Prisma, and PostgreSQL. All sub-modules listed in the sidebar are **live and database-backed**.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Map](#2-module-map)
3. [Overview Dashboard](#3-overview-dashboard)
4. [Employees](#4-employees)
5. [Departments](#5-departments)
6. [Positions](#6-positions)
7. [Attendance](#7-attendance)
8. [Leave](#8-leave)
9. [Payroll](#9-payroll)
10. [Performance](#10-performance)
11. [Recruitment (ATS)](#11-recruitment-ats)
12. [Learning (LMS)](#12-learning-lms)
13. [Documents (DMS + e-Sign)](#13-documents-dms--e-sign)
14. [Server Actions Catalog](#14-server-actions-catalog)
15. [Cross-Cutting Concerns](#15-cross-cutting-concerns)

---

## 1. Architecture Overview

| Layer | Location | Responsibility |
|---|---|---|
| Routes (UI) | `app/(tenant)/hr/**/page.tsx` | Server components, render dashboards/lists/forms |
| Components | `app/(tenant)/hr/**/_components/` | Client components (forms, action buttons, panels) |
| Server actions | `app/(tenant)/hr/actions.ts`, `actions-phase2.ts` | All mutations (create / update / delete / approve / run) |
| Service layer | `lib/services/hr/*.service.ts` | Pure data-access functions, called by routes & actions |
| Shared helpers | `lib/services/hr/_shared.ts` | Reusable query helpers and types |
| Auth gate | `requireTenant()` from `@/lib/auth` | Resolves `session.tenantId` for every page |
| Persistence | Prisma + PostgreSQL | Multi-tenant via `tenantId` column on every model |

**Request flow:** `page.tsx` → `requireTenant()` → `service.list*()` → render. Mutations: form → server action → service → Prisma → `revalidatePath()`.

---

## 2. Module Map

| Sidebar Item | Route | Service | Status |
|---|---|---|---|
| Overview | `/hr` | aggregates of employee, attendance, leave, department | Live |
| Employees | `/hr/employees` | `employee.service.ts` | Live |
| Departments | `/hr/departments` | `department.service.ts` | Live |
| Positions | `/hr/positions` | `department.service.ts` (position helpers) | Live |
| Attendance | `/hr/attendance` | `attendance.service.ts` | Live |
| Leave | `/hr/leave` | `leave.service.ts` | Live |
| Payroll | `/hr/payroll` | `payroll.service.ts` | Live |
| Performance | `/hr/performance` | `performance.service.ts` | Live |
| Recruitment | `/hr/recruitment` | `recruitment.service.ts` | Live |
| Learning | `/hr/learning` | `learning.service.ts` | Live |
| Documents | `/hr/documents` | `documents.service.ts` | Live |

---

## 3. Overview Dashboard

**Route:** `app/(tenant)/hr/page.tsx`

The HR landing page. Loads four data sources in parallel and renders a unified workforce snapshot.

### Data sources
- `getEmployeeStats(tenantId)` — totals + status breakdown
- `getAttendanceStats(tenantId)` — today's present / rate %
- `listLeaveRequests(tenantId, { status: "pending" })` — pending queue
- `listDepartments(tenantId)` — count of org units

### UI sections
1. **Quick action** — `Add Employee` button → `/hr/employees/new`
2. **Stat cards (4)**
   - Total Employees (`empStats.total` + `active` count)
   - Today's Attendance (`attStats.present` + `attendanceRate`%)
   - Pending Leave (`pendingLeave.length`)
   - Departments (`departments.length`)
3. **Workforce Status panel** — rows for `Active`, `On Leave`, `Terminated`
4. **Pending Leave Requests panel** — top 5, each showing employee name, leave type code (color-badged), days
5. **Modules grid** — 10 quick-link tiles to every sub-module with `Live` badge

---

## 4. Employees

**Routes:** `app/(tenant)/hr/employees/page.tsx`, `app/(tenant)/hr/employees/new/page.tsx`
**Service:** `lib/services/hr/employee.service.ts`
**Form:** `app/(tenant)/hr/employees/_components/employee-form.tsx`

### Purpose
Hire-to-retire employee record management. Single source of truth for workforce identity, contact info, employment terms, and compensation baseline.

### Sub-pages
| Path | Function |
|---|---|
| `/hr/employees` | Searchable / filterable list (status, department) |
| `/hr/employees/new` | Full creation form |

### Data model — `Employee`
| Group | Fields |
|---|---|
| Identity | `id`, `tenantId`, `empCode` (auto: `EMP0001`...), `fullName` |
| Contact | `email`, `phone`, `address`, `emergencyContactName`, `emergencyContactPhone` |
| Personal | `dob`, `gender`, `nationalId` |
| Employment | `employmentType` (`full_time` / `part_time` / `contract` / `intern` / `freelance`), `status` (`active` / `on_leave` / `terminated` / `suspended`), `hireDate`, `confirmationDate`, `terminationDate`, `terminationReason` |
| Compensation | `baseSalary`, `currency` |
| Org links | `departmentId`, `positionId`, `managerId` (self-FK), `userId` (1:1 to login `User`) |
| Audit | `createdAt`, `updatedAt` |

### Server actions
| Action | Effect |
|---|---|
| `createEmployeeAction` | Create employee + auto-assign `empCode` |
| `updateEmployeeAction` | Patch any field, reassign manager/dept/position |
| `terminateEmployeeAction` | Sets `status = terminated`, captures date + reason |

### Stats helper
`getEmployeeStats(tenantId)` returns `{ total, active, onLeave, terminated, suspended }`.

---

## 5. Departments

**Route:** `app/(tenant)/hr/departments/page.tsx`
**Service:** `lib/services/hr/department.service.ts`

### Purpose
Hierarchical org structure with cost-center tagging.

### Data model — `Department`
| Field | Notes |
|---|---|
| `id`, `tenantId` | scoping |
| `name`, `code` | display & shortcode |
| `parentId` | self-FK → enables nested tree |
| `headEmployeeId` | optional dept lead |
| `costCenter` | accounting tag |
| `description` | free text |

### Features
- Inline create / delete with form on the same page
- Hierarchical render (parent → children)
- Per-department employee count
- Delete is **blocked** while employees are still assigned
- Optional dept-head selector

---

## 6. Positions

**Route:** `app/(tenant)/hr/positions/page.tsx`
**Service:** Position helpers in `department.service.ts`

### Purpose
Job catalog. Positions belong to a department and can be flagged as managerial.

### Data model — `Position`
| Field | Notes |
|---|---|
| `id`, `tenantId` | scoping |
| `title` | "Senior Engineer", "Brand Manager"... |
| `grade`, `band`, `jobFamily` | classification |
| `isManager` | boolean — surfaces this role in manager pickers |
| `description` | free text |
| `departmentId` | FK to `Department` |

### Features
- Department-scoped position list
- Inline create / delete
- Managerial-role flag

---

## 7. Attendance

**Route:** `app/(tenant)/hr/attendance/page.tsx`
**Service:** `lib/services/hr/attendance.service.ts`
**Component:** `app/(tenant)/hr/attendance/_components/check-in-out-panel.tsx`

### Purpose
Daily attendance tracking with auto work-hour calculation.

### Data model — `AttendanceRecord`
| Field | Notes |
|---|---|
| `id`, `tenantId`, `employeeId` | scoping + relation |
| `date` | unique per `(employeeId, date)` |
| `checkIn`, `checkOut` | timestamps |
| `workHours` | computed on check-out |
| `status` | `present` / `absent` / `late` / `half_day` / `leave` / `holiday` |
| `notes` | free text |

### Features
- One-click **check-in** / **check-out**
- Auto `workHours` calculation (`checkOut - checkIn`)
- Today counters: present / absent / late
- Month-to-date records list
- Per-employee uniqueness enforced at DB level

### Server actions
| Action | Effect |
|---|---|
| `checkInAction` | Creates today's record with `checkIn` timestamp |
| `checkOutAction` | Updates today's record with `checkOut` + computed `workHours` |

### Stats helper
`getAttendanceStats(tenantId)` → `{ present, absent, late, attendanceRate }`.

---

## 8. Leave

**Routes:** `app/(tenant)/hr/leave/page.tsx`, `app/(tenant)/hr/leave/types/page.tsx`
**Service:** `lib/services/hr/leave.service.ts`
**Components:** `leave-request-form.tsx`, `leave-actions.tsx`

### Purpose
Multi-policy leave engine with configurable types, approval workflow, and balance tracking.

### Sub-pages
| Path | Function |
|---|---|
| `/hr/leave` | Tabs: Pending / Approved / Rejected; new-request form |
| `/hr/leave/types` | CRUD for leave types |

### Data models

**`LeaveType`**
| Field | Notes |
|---|---|
| `name`, `code` | "Annual Leave" / "AL" |
| `annualEntitlement` | days/year baseline |
| `isPaid` | flag |
| `requiresApproval` | gates workflow |
| `color` | UI badge tint |

**`LeaveRequest`**
| Field | Notes |
|---|---|
| `employeeId`, `leaveTypeId` | links |
| `startDate`, `endDate`, `days` | `days` auto-computed |
| `reason` | free text |
| `status` | `pending` / `approved` / `rejected` / `cancelled` |
| `approvedBy`, `approvedAt`, `rejectionReason` | audit |

**`LeaveBalance`** — per `(employeeId × leaveTypeId × year)`
| Field | Purpose |
|---|---|
| `entitled` | annual grant |
| `used` | consumed by approved requests |
| `pending` | reserved by pending requests |
| `carriedOver` | rollover from prior year |

### Server actions
| Action | Effect |
|---|---|
| `createLeaveTypeAction` / `deleteLeaveTypeAction` | Manage policy catalog |
| `createLeaveRequestAction` | Submit request, increments `pending` balance |
| `approveLeaveRequestAction` | Status → approved, moves `pending` → `used` |
| `rejectLeaveRequestAction` | Status → rejected, releases `pending` |

---

## 9. Payroll

**Routes:** `app/(tenant)/hr/payroll/page.tsx`, `/structures`, `/runs`, `/runs/new`
**Service:** `lib/services/hr/payroll.service.ts`
**Components:** `run-payroll-form.tsx`, `assign-salary-form.tsx`

### Purpose
End-to-end payroll engine: define structures → assign to employees → execute runs → emit payslips.

### Sub-pages
| Path | Function |
|---|---|
| `/hr/payroll` | KPI dashboard: structures, active salaries, runs, pending payslips |
| `/hr/payroll/structures` | Define structures & components |
| `/hr/payroll/runs` | History of past runs with totals |
| `/hr/payroll/runs/new` | Create period → assign salaries → execute run |

### Data models

**`SalaryStructure`** — named template (`Engineering Standard`, `Sales Commission`...)

**`SalaryComponent`** — line items belonging to a structure
| Field | Values |
|---|---|
| `name`, `code` | "Basic", "HRA", "PF" |
| `type` | `earning` or `deduction` |
| `calculationType` | `fixed` / `percent_of_basic` / `percent_of_gross` |
| `value` | amount or % |
| `taxable`, `isStatutory` | flags |
| `sortOrder` | rendering order |

**`EmployeeSalary`** — assigns a structure to an employee
| Field | Notes |
|---|---|
| `employeeId`, `structureId` | links |
| `baseSalary`, `currency` | per-employee base |
| `effectiveFrom`, `effectiveTo` | versioning |

**`PayrollPeriod`** — pay period definition
| Field | Notes |
|---|---|
| `name` | "April 2026" |
| `periodStart`, `periodEnd`, `payDate` | dates |
| `status` | `draft` / `processing` / `locked` / `paid` |

**`PayrollRun`** — execution record
| Field | Notes |
|---|---|
| `periodId` | FK |
| `status` | `pending` / `processing` / `completed` / `failed` |
| `totalGross`, `totalDeductions`, `totalNet` | aggregates |
| `employeeCount` | included staff |

**`Payslip`** + **`PayslipLine`** — per-employee output with line-level component breakdown (`componentName`, `componentCode`, `amount`, `type`, `sortOrder`).

### Server actions
| Action | Effect |
|---|---|
| `createSalaryStructureAction` | New structure |
| `addSalaryComponentAction` / `deleteSalaryComponentAction` | Manage components |
| `assignSalaryAction` | Assign structure + base to employee |
| `runPayrollAction` | Calculates earnings/deductions per assigned employee, emits payslips, updates run totals |

---

## 10. Performance

**Routes:** `app/(tenant)/hr/performance/page.tsx`, `/cycles`, `/goals`, `/reviews`
**Service:** `lib/services/hr/performance.service.ts`

### Purpose
OKR / KPI / 360-review system with cycle-bound goals and multi-rater feedback.

### Sub-pages
| Path | Function |
|---|---|
| `/hr/performance` | Active cycles, recent goals, completion stats |
| `/hr/performance/cycles` | Cycle CRUD with `draft → active → closed` lifecycle |
| `/hr/performance/goals` | OKR/KPI goals with progress tracking & parent-child hierarchy |
| `/hr/performance/reviews` | Multi-rater reviews |

### Data models

**`ReviewCycle`**
| Field | Notes |
|---|---|
| `name`, `type` | "FY26 Annual" |
| `startDate`, `endDate` | cycle window |
| `status` | `draft` / `active` / `closed` |

**`Goal`**
| Field | Notes |
|---|---|
| `employeeId`, `cycleId` | scoping |
| `title`, `description` | content |
| `type` | `okr` or `kpi` |
| `targetValue`, `currentValue`, `unit` | measurement |
| `weight`, `progress` | weighting % and computed % |
| `status` | `not_started` / `in_progress` / `achieved` / `missed` / `cancelled` |
| `parentGoalId` | self-FK → cascade objectives |

**`Review`**
| Field | Notes |
|---|---|
| `cycleId`, `employeeId`, `reviewerId` | scoping |
| `type` | `self` / `manager` / `peer` / `upward` |
| `overallRating` | 1-5 |
| `strengths`, `improvements`, `comments` | structured feedback |
| `status` | `draft` / `submitted` / `approved` |

### Server actions
| Action | Effect |
|---|---|
| `createCycleAction` / `activateCycleAction` / `closeCycleAction` | Lifecycle |
| `createGoalAction` / `updateGoalProgressAction` / `deleteGoalAction` | Goal management |
| `createReviewAction` | Submit a review |

---

## 11. Recruitment (ATS)

**Routes:** `app/(tenant)/hr/recruitment/page.tsx`, `/jobs`, `/candidates`, `/pipeline`
**Service:** `lib/services/hr/recruitment.service.ts`
**Component:** `pipeline-stage-mover.tsx`

### Purpose
Applicant tracking from job posting → candidate sourcing → pipeline → hire.

### Sub-pages
| Path | Function |
|---|---|
| `/hr/recruitment` | KPIs: open jobs, candidates, pipeline depth, hires |
| `/hr/recruitment/jobs` | Job-posting CRUD with dept/position links |
| `/hr/recruitment/candidates` | Candidate database |
| `/hr/recruitment/pipeline` | Kanban view by stage |

### Data models

**`JobPosting`**
| Field | Notes |
|---|---|
| `title`, `description`, `requirements` | content |
| `departmentId`, `positionId` | org context |
| `employmentType` | reuses Employee enum |
| `salaryMin`, `salaryMax`, `currency` | range |
| `location` | city / remote |
| `status` | `draft` / `open` / `on_hold` / `closed` |
| `hiringManagerId`, `openedAt`, `closedAt` | audit |

**`Candidate`**
| Field | Notes |
|---|---|
| `fullName`, `email`, `phone` | contact |
| `currentRole`, `currentCompany` | background |
| `resumeUrl`, `linkedinUrl` | links |
| `source` | "Referral", "LinkedIn"... |
| `notes` | free text |

**`Application`** — links candidate ↔ posting
| Field | Notes |
|---|---|
| `candidateId`, `jobPostingId` | links |
| `stage` | `applied` / `screening` / `interview` / `offer` / `hired` / `rejected` |
| `appliedAt`, `rejectedAt`, `hiredAt` | timeline |
| `rejectionReason`, `offerSalary` | outcome data |
| `notes` | free text |

### Server actions
| Action | Effect |
|---|---|
| `createJobPostingAction` / `updateJobPostingAction` / `closeJobPostingAction` | Job lifecycle |
| `addCandidateAction` | Add to talent pool |
| `createApplicationAction` | Link candidate to job (entry stage) |
| `moveApplicationAction` | Transition between Kanban stages |

---

## 12. Learning (LMS)

**Routes:** `app/(tenant)/hr/learning/page.tsx`, `/courses`, `/enrollments`
**Service:** `lib/services/hr/learning.service.ts`

### Purpose
Internal course catalog with module-based content, employee enrollment, progress tracking, and certification on completion.

### Sub-pages
| Path | Function |
|---|---|
| `/hr/learning` | KPIs: courses, enrollments, completed, completion rate % |
| `/hr/learning/courses` | Course CRUD + modules + publish toggle |
| `/hr/learning/enrollments` | Assign employees, track progress |

### Data models

**`Course`**
| Field | Notes |
|---|---|
| `title`, `description`, `category` | content |
| `durationHours` | total length |
| `level` | `beginner` / `intermediate` / `advanced` |
| `instructorName`, `thumbnailUrl` | metadata |
| `isPublished` | gating flag |

**`CourseModule`**
| Field | Notes |
|---|---|
| `courseId` | FK |
| `title`, `description` | content |
| `contentUrl` | external/internal link |
| `durationMinutes`, `sortOrder` | sequencing |

**`Enrollment`**
| Field | Notes |
|---|---|
| `courseId`, `employeeId` | links |
| `enrolledAt`, `startedAt`, `completedAt` | timeline |
| `progress` | 0-100 % |
| `status` | `enrolled` / `in_progress` / `completed` / `dropped` |

**`Certification`**
| Field | Notes |
|---|---|
| `enrollmentId` | FK |
| `certificateNumber` | unique |
| `issuedAt`, `expiresAt` | validity |
| `score` | optional |

### Server actions
| Action | Effect |
|---|---|
| `createCourseAction` | New course (with optional modules) |
| `enrollEmployeeAction` | Enroll one employee in one course |

---

## 13. Documents (DMS + e-Sign)

**Routes:** `app/(tenant)/hr/documents/page.tsx`, `/categories`
**Service:** `lib/services/hr/documents.service.ts`

### Purpose
Per-employee document vault with category taxonomy, retention policies, signature tracking, and expiry alerts for compliance.

### Sub-pages
| Path | Function |
|---|---|
| `/hr/documents` | Upload, search, filter by employee/category, expiring-soon alerts (30-day window) |
| `/hr/documents/categories` | Category CRUD |

### Data models

**`DocumentCategory`**
| Field | Notes |
|---|---|
| `name`, `description` | content |
| `retentionDays` | compliance retention period |
| `isRequired` | flags categories every employee must have |

**`EmployeeDocument`**
| Field | Notes |
|---|---|
| `employeeId`, `categoryId` | scoping |
| `name`, `description` | metadata |
| `fileUrl`, `fileSize`, `mimeType` | file info |
| `expiresAt` | drives alerts |
| `isSigned`, `signedAt`, `signedByName` | e-sign trail |
| `uploadedBy` | userId of uploader |

### Server actions
| Action | Effect |
|---|---|
| `createDocumentAction` / `deleteDocumentAction` | Document CRUD |
| `createDocumentCategoryAction` / `deleteDocumentCategoryAction` | Category CRUD (delete blocked if assigned) |

---

## 14. Server Actions Catalog

### Phase 1 — `app/(tenant)/hr/actions.ts`
- **Employees:** `createEmployeeAction`, `updateEmployeeAction`, `terminateEmployeeAction`
- **Departments:** `createDepartmentAction`, `deleteDepartmentAction`
- **Positions:** `createPositionAction`, `deletePositionAction`
- **Leave:** `createLeaveTypeAction`, `deleteLeaveTypeAction`, `createLeaveRequestAction`, `approveLeaveRequestAction`, `rejectLeaveRequestAction`
- **Attendance:** `checkInAction`, `checkOutAction`

### Phase 2 — `app/(tenant)/hr/actions-phase2.ts`
- **Payroll:** `createSalaryStructureAction`, `addSalaryComponentAction`, `deleteSalaryComponentAction`, `assignSalaryAction`, `runPayrollAction`
- **Performance:** `createCycleAction`, `activateCycleAction`, `closeCycleAction`, `createGoalAction`, `updateGoalProgressAction`, `deleteGoalAction`, `createReviewAction`
- **Recruitment:** `createJobPostingAction`, `updateJobPostingAction`, `closeJobPostingAction`, `addCandidateAction`, `createApplicationAction`, `moveApplicationAction`
- **Learning:** `createCourseAction`, `enrollEmployeeAction`
- **Documents:** `createDocumentAction`, `deleteDocumentAction`, `createDocumentCategoryAction`, `deleteDocumentCategoryAction`

---

## 15. Cross-Cutting Concerns

### Multi-tenancy
Every model carries `tenantId`. Every page calls `await requireTenant()` and passes `session.tenantId` into service calls. There is no global query path that bypasses tenant scoping.

### Service-layer convention
- Each domain has its own file in `lib/services/hr/`
- Services are pure async functions: `(tenantId, args) => Promise<T>`
- Stat helpers return narrow shapes (`{ total, active, ... }`) for fast dashboard loads
- Services never read auth — the route or action resolves it first

### Mutations
- All mutations live in server actions (`actions.ts` / `actions-phase2.ts`)
- Each action: validates input → calls service → `revalidatePath()`
- Forms are client components in `_components/` folders, posting to actions

### Validation & integrity
- Unique constraints: `Employee.empCode`, `AttendanceRecord (employeeId, date)`, `Certification.certificateNumber`
- Cascading deletes guarded: cannot delete a Department / DocumentCategory while children exist
- Foreign-key relations enforced at the DB level via Prisma

### Status / lifecycle enums
| Domain | Enum |
|---|---|
| Employee | `active` / `on_leave` / `terminated` / `suspended` |
| Attendance | `present` / `absent` / `late` / `half_day` / `leave` / `holiday` |
| Leave Request | `pending` / `approved` / `rejected` / `cancelled` |
| Payroll Period | `draft` / `processing` / `locked` / `paid` |
| Payroll Run | `pending` / `processing` / `completed` / `failed` |
| Review Cycle | `draft` / `active` / `closed` |
| Goal | `not_started` / `in_progress` / `achieved` / `missed` / `cancelled` |
| Review | `draft` / `submitted` / `approved` |
| Job Posting | `draft` / `open` / `on_hold` / `closed` |
| Application | `applied` / `screening` / `interview` / `offer` / `hired` / `rejected` |
| Enrollment | `enrolled` / `in_progress` / `completed` / `dropped` |

### Known stale doc
`src/modules/hr/README.md` still describes the HR module as a "future scope" prototype with 6 placeholder bullets. It pre-dates the actual build and should either be deleted or replaced with a pointer to this file.
