"use client";

import { useState, useMemo, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  Briefcase,
  ShieldCheck,
  PenTool,
  Eye,
  Loader2,
} from "lucide-react";
import {
  approveRequestAction,
  rejectRequestAction,
  requestChangesAction,
  approvalDetailAction,
  approveWithEditsAction,
  approveWithPayloadEditsAction,
} from "../actions";
import type { ApprovalDetail } from "@/lib/services/approvals.service";
import { ActivateNowButton } from "./activate-now-button";

type Approval = {
  id: string;
  type: string;
  typeLabel: string;
  status: "pending" | "approved" | "rejected";
  title: string;
  subtitle: string | null;
  requestedByName: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  reason: string | null;
  createdAt: string;
};

function StatCard({
  icon,
  title,
  value,
  variant,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  variant?: "warning" | "success" | "destructive";
}) {
  const bg =
    variant === "success"
      ? "bg-success/10 text-success"
      : variant === "destructive"
        ? "bg-destructive/10 text-destructive"
        : variant === "warning"
          ? "bg-warning/10 text-warning"
          : "bg-primary/10 text-primary";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

export function ApprovalsTab({
  approvals,
  stats,
}: {
  approvals: Approval[];
  stats: { pending: number; approved: number; rejected: number };
}) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [recommending, setRecommending] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ApprovalDetail>>({});
  const [, startReview] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function toggleReview(id: string) {
    if (reviewing === id) {
      setReviewing(null);
      return;
    }
    setReviewing(id);
    if (!details[id]) {
      setLoadingId(id);
      startReview(async () => {
        const res = await approvalDetailAction(id);
        setLoadingId(null);
        if (res && !("error" in res)) {
          setDetails((d) => ({ ...d, [id]: res }));
        }
      });
    }
  }

  // Type filter options are derived from the data — any new approval kind
  // shows up automatically with no UI change.
  const typeOptions = useMemo(() => {
    const m = new Map<string, string>();
    approvals.forEach((a) => m.set(a.type, a.typeLabel));
    return Array.from(m, ([value, label]) => ({ value, label })).sort((x, y) =>
      x.label.localeCompare(y.label)
    );
  }, [approvals]);

  const filtered = useMemo(
    () =>
      approvals.filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (typeFilter !== "all" && a.type !== typeFilter) return false;
        return true;
      }),
    [approvals, statusFilter, typeFilter]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Clock className="h-4 w-4" />} title="Pending" value={stats.pending} variant="warning" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} title="Approved" value={stats.approved} variant="success" />
        <StatCard icon={<XCircle className="h-4 w-4" />} title="Rejected" value={stats.rejected} variant="destructive" />
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Approvals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {typeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <ShieldCheck className="h-8 w-8 opacity-40" />
              <span className="text-sm">Nothing here</span>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {a.type === "employee_onboarding" ? (
                          <UserPlus className="h-4 w-4" />
                        ) : (
                          <Briefcase className="h-4 w-4" />
                        )}
                        {/* generic icon — Briefcase covers all other kinds */}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{a.title}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {a.typeLabel}
                          </Badge>
                          {a.status === "pending" && (
                            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                          )}
                          {a.status === "approved" && (
                            <Badge variant="default" className="gap-1 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5" />Approved
                            </Badge>
                          )}
                          {a.status === "rejected" && (
                            <Badge variant="destructive" className="text-[10px]">Rejected</Badge>
                          )}
                        </div>
                        {a.subtitle && (
                          <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Requested by {a.requestedByName ?? "—"} ·{" "}
                          {new Date(a.createdAt).toLocaleString()}
                          {a.decidedByName &&
                            ` · ${a.status} by ${a.decidedByName}`}
                        </p>
                        {a.reason && (
                          <p className="mt-1 text-[11px] text-destructive">
                            Reason: {a.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        onClick={() => toggleReview(a.id)}
                        title="Inspect the record before deciding"
                      >
                        {loadingId === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        Review
                      </Button>

                      {a.status === "pending" && (
                        <>
                          <form action={approveRequestAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <Button type="submit" size="sm" className="h-8 gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </form>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={() => {
                            setRecommending(
                              recommending === a.id ? null : a.id
                            );
                            setRejecting(null);
                          }}
                          title="Send back with a recommendation"
                        >
                          <PenTool className="h-3.5 w-3.5" />
                          Request changes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-destructive"
                          onClick={() => {
                            setRejecting(rejecting === a.id ? null : a.id);
                            setRecommending(null);
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {a.status === "pending" &&
                    a.type === "employee_onboarding" && (
                      <div className="mt-2 flex justify-end">
                        <ActivateNowButton id={a.id} />
                      </div>
                    )}

                  {reviewing === a.id && (
                    <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-3 text-xs">
                      {loadingId === a.id && !details[a.id] ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading…
                        </div>
                      ) : details[a.id] ? (
                        <div className="space-y-3">
                          {details[a.id].note && (
                            <p className="rounded bg-warning/10 px-2 py-1 text-[11px] text-warning">
                              {details[a.id].note}
                            </p>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 font-semibold">Current</p>
                              <dl className="space-y-1">
                                {details[a.id].current.map((f, i) => (
                                  <div key={i}>
                                    <dt className="text-[10px] uppercase text-muted-foreground">
                                      {f.label}
                                    </dt>
                                    <dd className="whitespace-pre-wrap break-words">
                                      {f.value}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                            {details[a.id].editableJob ? (
                              <form
                                action={approveWithEditsAction}
                                className="space-y-1.5"
                              >
                                <p className="mb-1 font-semibold text-primary">
                                  Proposed — editable by admin
                                </p>
                                <input type="hidden" name="id" value={a.id} />
                                <Input
                                  name="title"
                                  required
                                  defaultValue={details[a.id].editableJob!.title}
                                  placeholder="Title"
                                  className="h-7 text-xs"
                                />
                                <Input
                                  name="location"
                                  defaultValue={
                                    details[a.id].editableJob!.location
                                  }
                                  placeholder="Location"
                                  className="h-7 text-xs"
                                />
                                <select
                                  name="employmentType"
                                  defaultValue={
                                    details[a.id].editableJob!.employmentType
                                  }
                                  className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  <option value="full_time">Full-time</option>
                                  <option value="part_time">Part-time</option>
                                  <option value="contract">Contract</option>
                                  <option value="intern">Intern</option>
                                </select>
                                <div className="flex gap-1.5">
                                  <Input
                                    name="salaryMin"
                                    type="number"
                                    defaultValue={
                                      details[a.id].editableJob!.salaryMin
                                    }
                                    placeholder="Min salary"
                                    className="h-7 text-xs"
                                  />
                                  <Input
                                    name="salaryMax"
                                    type="number"
                                    defaultValue={
                                      details[a.id].editableJob!.salaryMax
                                    }
                                    placeholder="Max salary"
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <Textarea
                                  name="description"
                                  required
                                  rows={3}
                                  defaultValue={
                                    details[a.id].editableJob!.description
                                  }
                                  placeholder="Description"
                                  className="text-xs"
                                />
                                <Textarea
                                  name="requirements"
                                  rows={2}
                                  defaultValue={
                                    details[a.id].editableJob!.requirements
                                  }
                                  placeholder="Requirements"
                                  className="text-xs"
                                />
                                {a.status === "pending" && (
                                  <Button
                                    type="submit"
                                    size="sm"
                                    className="h-7 w-full gap-1"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Approve with these changes
                                  </Button>
                                )}
                              </form>
                            ) : details[a.id].editableFields ? (
                              <form
                                action={approveWithPayloadEditsAction}
                                className="space-y-1.5"
                              >
                                <p className="mb-1 font-semibold text-primary">
                                  Proposed — editable by admin
                                </p>
                                <input type="hidden" name="id" value={a.id} />
                                {details[a.id].editableFields!.map((f) => (
                                  <div key={f.name} className="space-y-0.5">
                                    <label className="text-[10px] uppercase text-muted-foreground">
                                      {f.label}
                                    </label>
                                    {f.type === "textarea" ? (
                                      <Textarea
                                        name={f.name}
                                        rows={2}
                                        defaultValue={f.value}
                                        className="text-xs"
                                      />
                                    ) : (
                                      <Input
                                        name={f.name}
                                        type={
                                          f.type === "number"
                                            ? "number"
                                            : f.type === "date"
                                              ? "date"
                                              : "text"
                                        }
                                        defaultValue={f.value}
                                        className="h-7 text-xs"
                                      />
                                    )}
                                  </div>
                                ))}
                                {a.status === "pending" && (
                                  <Button
                                    type="submit"
                                    size="sm"
                                    className="h-7 w-full gap-1"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Approve with these changes
                                  </Button>
                                )}
                              </form>
                            ) : details[a.id].proposed ? (
                              <div>
                                <p className="mb-1 font-semibold text-primary">
                                  Proposed
                                </p>
                                <dl className="space-y-1">
                                  {details[a.id].proposed!.map((f, i) => (
                                    <div key={i}>
                                      <dt className="text-[10px] uppercase text-muted-foreground">
                                        {f.label}
                                      </dt>
                                      <dd className="whitespace-pre-wrap break-words">
                                        {f.value}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          Could not load details.
                        </p>
                      )}
                    </div>
                  )}

                  {recommending === a.id && (
                    <form
                      action={requestChangesAction}
                      className="mt-3 space-y-2 rounded-md border border-warning/40 bg-warning/5 p-2.5"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <Textarea
                        name="recommendation"
                        rows={2}
                        required
                        placeholder="What should the requester change before resubmitting?"
                        className="text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setRecommending(null)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" className="h-7">
                          Send recommendation
                        </Button>
                      </div>
                    </form>
                  )}

                  {rejecting === a.id && (
                    <form
                      action={rejectRequestAction}
                      className="mt-3 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <Textarea
                        name="reason"
                        rows={2}
                        placeholder="Reason for rejection (optional)"
                        className="text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setRejecting(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                          className="h-7"
                        >
                          Confirm reject
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
