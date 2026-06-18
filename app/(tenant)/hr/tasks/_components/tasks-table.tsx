"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ListChecks, SquarePen, Trash2, Plus, Gauge } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskStatus, TaskPriority } from "@prisma/client";
import {
  setTaskStatusAction,
  deleteTasksAction,
  toggleChecklistItemAction,
  addChecklistItemAction,
  deleteChecklistItemAction,
} from "../actions";
import { TaskDetailDialog, type ChecklistItemRow, type CommentRow } from "./task-detail-dialog";
import { EditTaskDialog, type EditableTask } from "./edit-task-dialog";

type EmployeeOption = { id: string; fullName: string; empCode: string };
type GoalOption = { id: string; title: string; employeeName: string };

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeCode: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progressPct: number;
  dueDate: string | null; // ISO date or null
  startDate: string | null;
  overdue: boolean;
  goalId: string | null;
  goalTitle: string | null;
  canEdit: boolean;
  checklist: ChecklistItemRow[];
  comments: CommentRow[];
  proofUrl: string | null;
  proofNote: string | null;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  submitted: "In review",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TasksTable({
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
  const [pending, startTransition] = useTransition();
  // Track the open dialogs by id and derive the live row from `rows`, so a
  // checklist toggle / status change re-renders the dialog when fresh `rows`
  // arrive (the realtime provider refreshes the server tree on activity).
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const detail = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  const columns: Column<TaskRow>[] = [
    {
      key: "title",
      header: "Task",
      width: "26%",
      cell: (t) => (
        <div>
          <p className="font-medium text-sm">{t.title}</p>
          {t.goalTitle && (
            <p className="text-[10px] text-muted-foreground">↳ goal: {t.goalTitle}</p>
          )}
        </div>
      ),
    },
    {
      key: "assignee",
      header: "Assignee",
      width: "16%",
      cell: (t) =>
        t.assigneeName ? (
          <div>
            <p className="text-sm">{t.assigneeName}</p>
            <p className="text-xs text-muted-foreground font-mono">{t.assigneeCode}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        ),
    },
    {
      key: "progress",
      header: "Progress",
      width: "16%",
      cell: (t) => (
        <button
          type="button"
          onClick={() => setDetailId(t.id)}
          className="group flex w-full flex-col gap-1 text-left"
          title="Open checklist"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-muted-foreground group-hover:text-foreground">
              <ListChecks className="h-3 w-3" />
              {t.checklist.length > 0
                ? `${t.checklist.filter((i) => i.isChecked).length}/${t.checklist.length}`
                : "—"}
            </span>
            <span className="font-semibold">{t.progressPct}%</span>
          </div>
          <Progress value={t.progressPct} className="h-1.5" />
        </button>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      width: "10%",
      cell: (t) => (
        <Badge className={PRIORITY_STYLE[t.priority]} variant="outline">
          {t.priority}
        </Badge>
      ),
    },
    {
      key: "due",
      header: "Due",
      width: "12%",
      className: "text-xs whitespace-nowrap",
      cell: (t) => (
        <span className={t.overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
          {fmtDate(t.dueDate)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "18%",
      cell: (t) => (
        <Select
          // Controlled (not defaultValue): an employee's "Done" is converted to
          // "submitted" (In review) server-side, so the dropdown must reflect the
          // TRUE saved status after revalidation — never a stale local pick.
          value={t.status}
          onValueChange={(v) =>
            startTransition(async () => {
              await setTaskStatusAction(t.id, v as TaskStatus);
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(t) => t.id}
        itemNoun="tasks"
        tableMinWidth="980px"
        actionsWidth={canAssign ? "9rem" : "6rem"}
        renderExpanded={(t) => <TaskSubtasks task={t} canDelete={canAssign} />}
        actionsCell={(t) => (
          <>
            <Button variant="ghost" size="icon" title="Checklist & details" onClick={() => setDetailId(t.id)}>
              <ListChecks className="h-4 w-4" />
            </Button>
            {t.canEdit && (
              <Button variant="ghost" size="icon" title="Edit task" onClick={() => setEditing(t)}>
                <SquarePen className="h-4 w-4" />
              </Button>
            )}
            {canAssign && t.canEdit && (
              <Button
                variant="ghost"
                size="icon"
                title="Delete task"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteTasksAction([t.id]);
                  })
                }
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
        onBulkDelete={
          canAssign
            ? async (ids) => {
                await deleteTasksAction(ids);
              }
            : undefined
        }
        emptyState={<p className="text-sm text-muted-foreground">No tasks yet.</p>}
      />

      <TaskDetailDialog
        open={detail !== null}
        onOpenChange={(v) => !v && setDetailId(null)}
        task={
          detail && {
            id: detail.id,
            title: detail.title,
            status: detail.status,
            progressPct: detail.progressPct,
            goalTitle: detail.goalTitle,
            canEdit: detail.canEdit,
            checklist: detail.checklist,
            comments: detail.comments,
            isAdmin,
            currentEmployeeId,
            proofUrl: detail.proofUrl,
            proofNote: detail.proofNote,
            canVerify: isAdmin || (canAssign && detail.assigneeId !== currentEmployeeId),
            isOwnTask: !!currentEmployeeId && detail.assigneeId === currentEmployeeId,
            canManage: canAssign,
          }
        }
      />

      <EditTaskDialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        employees={employees}
        goals={goals}
        isAdmin={isAdmin}
        canAssign={canAssign}
        task={
          editing &&
          ({
            id: editing.id,
            title: editing.title,
            description: editing.description,
            priority: editing.priority,
            dueDate: editing.dueDate ? editing.dueDate.slice(0, 10) : null,
            startDate: editing.startDate ? editing.startDate.slice(0, 10) : null,
            goalId: editing.goalId,
            assigneeId: editing.assigneeId,
          } satisfies EditableTask)
        }
      />
    </>
  );
}

/**
 * Inline subtasks panel rendered beneath a task row (the expand chevron). Ticking
 * a sub-item calls the server, which recomputes the task's progress % and cascades
 * into the linked goal — the new % flows back into the live progress bar shown
 * here and in the row above once fresh data arrives.
 */
function TaskSubtasks({ task, canDelete }: { task: TaskRow; canDelete: boolean }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  const checked = task.checklist.filter((i) => i.isChecked).length;
  const total = task.checklist.length;

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      {/* Live score header — moves the instant a sub-item is toggled */}
      <div className="mb-2.5 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Subtasks</span>
        <span className="text-[11px] text-muted-foreground">
          {total > 0 ? `${checked}/${total} done` : "status-based"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Progress value={task.progressPct} className="h-1.5 w-28" />
          <span className="w-9 text-right text-sm font-bold tabular-nums">
            {task.progressPct}%
          </span>
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-center text-[11px] text-muted-foreground">
          No subtasks yet.{" "}
          {task.canEdit ? "Add one below to track partial progress." : "Progress follows the task status."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {task.checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-md border border-border/50 bg-card/60 px-2.5 py-1.5"
            >
              <Checkbox
                checked={item.isChecked}
                disabled={!task.canEdit || pending}
                onCheckedChange={(v) => run(() => toggleChecklistItemAction(item.id, v === true))}
              />
              <span
                className={`flex-1 text-xs ${item.isChecked ? "text-muted-foreground line-through" : ""}`}
              >
                {item.label}
              </span>
              {canDelete && task.canEdit && (
                <button
                  type="button"
                  aria-label="Delete subtask"
                  disabled={pending}
                  onClick={() => run(() => deleteChecklistItemAction(item.id))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {task.canEdit && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                e.preventDefault();
                const label = draft.trim();
                setDraft("");
                run(() => addChecklistItemAction(task.id, label));
              }
            }}
            placeholder="Add a subtask and press Enter"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !draft.trim()}
            onClick={() => {
              const label = draft.trim();
              setDraft("");
              run(() => addChecklistItemAction(task.id, label));
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}