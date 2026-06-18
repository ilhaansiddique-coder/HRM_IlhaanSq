"use client";

// Task detail — checklist management + live progress. Opened from the tasks
// table. Ticking a sub-item recomputes the task's progress %, which (if the
// task is linked to a goal) cascades into that goal's rollup on the server.

import { useState, useTransition } from "react";
import {
  CheckSquare,
  Plus,
  Target,
  Trash2,
  MessageSquare,
  Send,
  ShieldCheck,
  Upload,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  addChecklistItemAction,
  toggleChecklistItemAction,
  deleteChecklistItemAction,
  addCommentAction,
  deleteCommentAction,
  submitTaskAction,
  reviewTaskAction,
} from "../actions";

export type ChecklistItemRow = { id: string; label: string; isChecked: boolean };
export type CommentRow = {
  id: string;
  body: string;
  authorName: string | null;
  authorId: string | null;
  createdAt: string;
};

export type TaskDetail = {
  id: string;
  title: string;
  status: string;
  progressPct: number;
  goalTitle: string | null;
  canEdit: boolean;
  checklist: ChecklistItemRow[];
  comments: CommentRow[];
  isAdmin: boolean;
  currentEmployeeId: string | null;
  proofUrl: string | null;
  proofNote: string | null;
  canVerify: boolean; // admin or this assignee's manager
  isOwnTask: boolean; // the current user is the assignee
  canManage: boolean; // admin/manager — may delete subtasks (employees cannot)
};

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
}: {
  task: TaskDetail | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  if (!task) return null;

  const checked = task.checklist.filter((i) => i.isChecked).length;
  const total = task.checklist.length;

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            {task.title}
          </DialogTitle>
          <DialogDescription>Checklist &amp; progress</DialogDescription>
        </DialogHeader>

        {/* Progress + goal link */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {total > 0 ? `${checked} / ${total} items` : "Status-based progress"}
            </span>
            <span className="font-semibold">{task.progressPct}%</span>
          </div>
          <Progress value={task.progressPct} className="h-2" />
          {task.goalTitle && (
            <Badge variant="outline" className="mt-1 gap-1.5">
              <Target className="h-3 w-3 text-primary" />
              Feeds goal: {task.goalTitle}
            </Badge>
          )}
        </div>

        {/* Completion proof + verification */}
        {(task.status === "submitted" || task.proofUrl || task.proofNote) && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {task.status === "submitted" ? "Awaiting verification" : "Submitted proof"}
            </p>
            {task.proofNote && <p className="text-xs">{task.proofNote}</p>}
            {task.proofUrl && (
              <a
                href={task.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View proof
              </a>
            )}
            {task.status === "submitted" && task.canVerify && (
              <div className="space-y-2 border-t border-amber-500/20 pt-2">
                <Input
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Optional feedback (required to reject)…"
                  className="h-8 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={pending}
                    onClick={() => run(() => reviewTaskAction(task.id, "approve", ""))}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 border-destructive/40 text-destructive"
                    disabled={pending || !rejectNote.trim()}
                    onClick={() => {
                      const fb = rejectNote.trim();
                      setRejectNote("");
                      run(() => reviewTaskAction(task.id, "reject", fb));
                    }}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit-for-review (the assignee's own, not-yet-done task) */}
        {task.isOwnTask && !task.canVerify && task.status !== "done" && task.status !== "submitted" && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Upload className="h-3.5 w-3.5 text-primary" />
              Submit for review
            </p>
            <Input
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="Proof link (Drive, screenshot, doc URL)…"
              className="h-8 text-xs"
            />
            <Textarea
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              rows={2}
              placeholder="Note for your manager (optional)…"
              className="text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={pending}
              onClick={() => {
                const u = proofUrl.trim();
                const n = proofNote.trim();
                setProofUrl("");
                setProofNote("");
                run(() => submitTaskAction(task.id, u, n));
              }}
            >
              <Send className="h-4 w-4" /> Submit for review
            </Button>
          </div>
        )}

        {/* Checklist items */}
        <div className="space-y-1.5">
          {task.checklist.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
              No sub-items yet. Add some below to track partial progress.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {task.checklist.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/60 px-2.5 py-2"
                >
                  <Checkbox
                    checked={item.isChecked}
                    disabled={!task.canEdit || pending}
                    onCheckedChange={(v) =>
                      run(() => toggleChecklistItemAction(item.id, v === true))
                    }
                  />
                  <span
                    className={`flex-1 text-xs ${
                      item.isChecked ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {item.label}
                  </span>
                  {task.canManage && task.canEdit && (
                    <button
                      type="button"
                      aria-label="Delete item"
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
        </div>

        {/* Add item */}
        {task.canEdit && (
          <div className="flex items-center gap-2">
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
              placeholder="Add a sub-item and press Enter"
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

        {/* Comments thread */}
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments ({task.comments.length})
          </p>
          {task.comments.length > 0 && (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {task.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium">{c.authorName ?? "Someone"}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      {(task.isAdmin || c.authorId === task.currentEmployeeId) && (
                        <button
                          type="button"
                          aria-label="Delete comment"
                          disabled={pending}
                          onClick={() => run(() => deleteCommentAction(c.id))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          {task.canEdit && (
            <div className="flex items-center gap-2">
              <Input
                value={commentDraft}
                disabled={pending}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && commentDraft.trim()) {
                    e.preventDefault();
                    const body = commentDraft.trim();
                    setCommentDraft("");
                    run(() => addCommentAction(task.id, body));
                  }
                }}
                placeholder="Write a comment…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !commentDraft.trim()}
                onClick={() => {
                  const body = commentDraft.trim();
                  setCommentDraft("");
                  run(() => addCommentAction(task.id, body));
                }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}