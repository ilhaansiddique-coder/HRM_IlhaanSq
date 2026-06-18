"use client";

// Edit an existing task — title/description/priority/dates for everyone;
// assignee (reassign) + goal link for admins. Reuses updateTaskAction and
// reassignTaskAction; no new server code.

import { useState } from "react";
import { SquarePen, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { updateTaskAction, reassignTaskAction } from "../actions";

type EmployeeOption = { id: string; fullName: string; empCode: string };
type GoalOption = { id: string; title: string; employeeName: string };

export type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null; // yyyy-mm-dd
  startDate: string | null;
  goalId: string | null;
  assigneeId: string | null;
};

const NONE = "__none__";

export function EditTaskDialog({
  task,
  employees,
  goals,
  isAdmin,
  canAssign,
  open,
  onOpenChange,
}: {
  task: EditableTask | null;
  employees: EmployeeOption[];
  goals: GoalOption[];
  isAdmin: boolean;
  canAssign: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string>(task?.assigneeId ?? NONE);
  const [goalId, setGoalId] = useState<string>(task?.goalId ?? NONE);

  if (!task) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setAssignee(task.assigneeId ?? NONE);
          setGoalId(task.goalId ?? NONE);
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="!h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SquarePen className="h-5 w-5 text-primary" />
            Edit Task
          </DialogTitle>
          <DialogDescription>Update task details</DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            setError(null);
            formData.set("id", task.id);
            if (isAdmin) formData.set("goalId", goalId === NONE ? "" : goalId);
            const res = await updateTaskAction(formData);
            if (!res.ok) {
              setError(res.error ?? "Failed to update task");
              return;
            }
            // Reassign is a separate call (admins anyone, managers their team);
            // only fire when the assignee actually changed.
            if (canAssign && (assignee === NONE ? null : assignee) !== task.assigneeId) {
              const r = await reassignTaskAction(task.id, assignee === NONE ? null : assignee);
              if (!r.ok) {
                setError(r.error ?? "Failed to reassign");
                return;
              }
            }
            onOpenChange(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="title" name="title" required minLength={2} defaultValue={task.title} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {canAssign && (
              <div className="space-y-1.5">
                <Label className="text-xs">Assignee</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.fullName} ({e.empCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select name="priority" defaultValue={task.priority}>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs">Start date</Label>
              <DatePicker id="startDate" name="startDate" defaultValue={task.startDate ?? ""} placeholder="Select date" showPresets />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="text-xs">Due date</Label>
              <DatePicker id="dueDate" name="dueDate" defaultValue={task.dueDate ?? ""} placeholder="Select date" showPresets />
            </div>
          </div>

          {isAdmin && goals.length > 0 && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Target className="h-3.5 w-3.5 text-primary" />
                Link to Goal
              </Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger>
                  <SelectValue placeholder="No goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No goal — standalone</SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title} · {g.employeeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={task.description ?? ""} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full">
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}