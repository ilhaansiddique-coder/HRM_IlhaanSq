"use client";

// "+" new-task action for the Tasks page. Renders the trigger + dialog into the
// global TopBar (portal into #topbar-action-slot) so the button sits just left
// of the notification bell, but only while this page is mounted.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, CheckSquare, X, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTaskAction } from "../actions";

type EmployeeOption = { id: string; fullName: string; empCode: string };
type GoalOption = { id: string; title: string; employeeName: string };

export function NewTaskDialog({
  employees,
  goals,
  isAdmin,
  canAssign,
}: {
  employees: EmployeeOption[];
  goals: GoalOption[];
  isAdmin: boolean;
  canAssign: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  function addItem() {
    const v = draft.trim();
    if (!v) return;
    setItems((prev) => [...prev, v]);
    setDraft("");
  }

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const slot = document.getElementById("topbar-action-slot");
  if (!slot) return null;

  return createPortal(
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="New task"
          title="New task"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="!h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            New Task
          </DialogTitle>
          <DialogDescription>Assign work to a team member</DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            setError(null);
            const res = await createTaskAction(formData);
            if (res.ok) {
              setOpen(false);
              setItems([]);
              setDraft("");
            } else setError(res.error ?? "Failed to create task");
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="title" name="title" required minLength={2} placeholder="Prepare Q3 report" />
          </div>

          {/* Goal link (admin only) — the Task→Performance bridge. Promoted to the
              top and required so every admin-created task feeds a goal by default;
              "Standalone" is an explicit opt-out. */}
          {isAdmin && (
            <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Target className="h-3.5 w-3.5 text-primary" />
                Link to Goal <span className="text-destructive">*</span>
              </Label>
              {goals.length > 0 ? (
                <Select name="goalId" required defaultValue="_standalone">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a goal…" />
                  </SelectTrigger>
                  <SelectContent>
                    {goals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.title} · {g.employeeName}
                      </SelectItem>
                    ))}
                    <SelectItem value="_standalone" className="text-muted-foreground">
                      Standalone — no goal
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-dashed border-border/60 px-2.5 py-2 text-[11px] text-muted-foreground">
                  No goals yet — create a goal in Performance to link tasks. This
                  task will be standalone.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Progress on this task rolls up into the goal automatically.
              </p>
            </div>
          )}

          {/* Assignee + Priority share a row */}
          <div className="grid grid-cols-2 gap-3">
            {canAssign && (
              <div className="space-y-1.5">
                <Label className="text-xs">Assignee</Label>
                <Select name="assigneeId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No employees
                      </SelectItem>
                    ) : (
                      employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.fullName} ({e.empCode})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Start + Due dates share a row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs">Start date</Label>
              <DatePicker id="startDate" name="startDate" placeholder="Select date" showPresets />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="text-xs">Due date</Label>
              <DatePicker id="dueDate" name="dueDate" placeholder="Select date" showPresets />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>

          {/* Checklist sub-items — drive the live progress % */}
          <div className="space-y-1.5">
            <Label className="text-xs">Checklist (sub-items)</Label>
            {items.length > 0 && (
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"
                  >
                    {/* Posted to the server as repeated "checklist" fields */}
                    <input type="hidden" name="checklist" value={item} />
                    <span className="flex-1 text-xs">{item}</span>
                    <button
                      type="button"
                      aria-label="Remove item"
                      onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Add a sub-item and press Enter"
              />
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}