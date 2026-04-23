import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  KeyRound,
  Mail,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { supabase, supabaseAnonKey, supabaseUrl } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clearAuthBridgeCookies } from "@/lib/authBridge";
import { isSupabaseSessionForProject } from "@/lib/supabaseProjectAuth";
import { toast } from "@/utils/toast";
import { invokeProtectedFunction } from "@/utils/invokeProtectedFunction";

interface DemoRequestRow {
  id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  business_type: string;
  message: string | null;
  requested_domain: string | null;
  requested_package: "starter" | "professional" | "enterprise" | null;
  status: string;
  tenant_id: string | null;
  approved_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  request_notification_status: "pending" | "sent" | "failed" | "skipped";
  request_notification_sent_at: string | null;
  request_notification_error: string | null;
}

interface ApprovalResult {
  request_id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  temp_password: string;
  login_url: string;
  approval_email_sent: boolean;
}

interface ResetResult {
  request_id: string;
  previous_status: string;
  status: "pending";
}

interface RejectResult {
  request_id: string;
  status: "rejected";
  deleted: true;
}

interface RetryNotificationsResult {
  attempted_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
}

interface ActionFeedback {
  message: string;
  tone: "success" | "muted";
}

type ReviewAction = "approved" | "rejected" | "reset";

const requestedPackageLabels: Record<NonNullable<DemoRequestRow["requested_package"]>, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

interface PendingAction {
  requestId: string;
  action: ReviewAction;
  fullName: string;
  status: string;
}

const formatNotificationError = (value: string | null): string | null => {
  if (!value) return null;

  const normalized = value.toLowerCase();
  if (normalized.includes("domain is not verified")) {
    return "Legacy email-provider error in this old request record. Deploy latest functions and retry verification email.";
  }
  if (normalized.includes("supabase_anon_key")) {
    return "Verification email is not configured on the server (missing SUPABASE_ANON_KEY).";
  }

  return value;
};

const formatDateTime = (value: string | null) => {
  if (!value) return null;
  return new Date(value).toLocaleString();
};

const clearApprovalSession = async () => {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Best-effort cleanup only.
  }

  clearAuthBridgeCookies();
};

const getFreshAccessToken = async (): Promise<string> => {
  const refreshed = await supabase.auth.refreshSession();
  let accessToken = refreshed.data.session?.access_token ?? null;
  let sessionError = refreshed.error;

  if (!accessToken) {
    const fallback = await supabase.auth.getSession();
    accessToken = fallback.data.session?.access_token ?? null;
    sessionError = sessionError || fallback.error;
  }

  if (sessionError || !accessToken) {
    throw new Error("Missing auth session. Please sign out and sign in again.");
  }

  if (!isSupabaseSessionForProject(accessToken, supabaseUrl)) {
    await clearApprovalSession();
    throw new Error("Your saved session belongs to a different Supabase project. Please sign in again.");
  }

  return accessToken;
};

const ensureValidApprovalSession = async (accessToken: string): Promise<void> => {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (!error && data.user) {
    return;
  }

  await clearApprovalSession();
  throw new Error("Your session is invalid for this Supabase project. Please sign in again.");
};

const extractApprovalErrorMessage = async (response: Response): Promise<string> => {
  const bodyText = (await response.text())?.trim() ?? "";
  if (!bodyText) {
    return `Tenant approval failed (HTTP ${response.status})`;
  }

  try {
    const parsed = JSON.parse(bodyText) as { error?: string; message?: string };
    const message = String(parsed.error ?? parsed.message ?? bodyText).trim();
    return `${message} (HTTP ${response.status})`;
  } catch {
    return `${bodyText} (HTTP ${response.status})`;
  }
};

const invokeDemoRequestApprove = async (payload: {
  request_id: string;
  review_notes: string;
  initial_password?: string;
}): Promise<ApprovalResult> => {
  const accessToken = await getFreshAccessToken();
  await ensureValidApprovalSession(accessToken);
  const response = await fetch(`${supabaseUrl}/functions/v1/demo-request-approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await extractApprovalErrorMessage(response);
    if (/invalid jwt|unauthorized|http 401|\b401\b/i.test(message)) {
      throw new Error("Supabase rejected the approval request token. Refresh the app and sign in again if the problem continues.");
    }

    throw new Error(message);
  }

  const data = (await response.json()) as ApprovalResult | null;
  if (!data) {
    throw new Error("Failed to approve tenant request.");
  }

  return data;
};

const RequestStatusBadge = ({ status }: { status: string }) => {
  const isPending = status === "pending";

  return (
    <Badge variant={isPending ? "secondary" : status === "approved" ? "default" : "destructive"}>
      {isPending ? (
        <span className="flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          Pending
        </span>
      ) : status === "approved" ? (
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      )}
    </Badge>
  );
};

const NotificationStatusBadge = ({
  status,
}: {
  status: DemoRequestRow["request_notification_status"];
}) => (
  <Badge
    variant={status === "sent" ? "default" : status === "pending" ? "secondary" : "outline"}
    className={
      status === "failed"
        ? "border-destructive/40 text-destructive"
        : status === "skipped"
          ? "border-amber-300/50 text-amber-700"
          : undefined
    }
  >
    {status === "sent"
      ? "Sent"
      : status === "failed"
        ? "Failed"
        : status === "skipped"
          ? "Skipped"
          : "Pending"}
  </Badge>
);

export function DemoRequestsInbox() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useUserRole();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [initialPasswords, setInitialPasswords] = useState<Record<string, string>>({});
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, ActionFeedback>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-requests-superadmin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_requests" as never)
        .select(
          "id, full_name, business_name, email, phone, business_type, message, requested_domain, requested_package, status, tenant_id, approved_user_id, reviewed_at, created_at, request_notification_status, request_notification_sent_at, request_notification_error",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as DemoRequestRow[];
    },
    enabled: isSuperAdmin,
    staleTime: 0,
  });

  const visibleRequests = useMemo(
    () =>
      (data ?? []).filter(
        (row) => row.status !== "rejected",
      ),
    [data],
  );

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      pending: rows.filter((row) => row.status === "pending").length,
      approved: rows.filter((row) => row.status === "approved").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    };
  }, [data]);

  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: ReviewAction }) => {
      if (action === "approved") {
        const data = await invokeDemoRequestApprove({
          request_id: requestId,
          review_notes: reviewNotes[requestId] ?? "",
          initial_password: (initialPasswords[requestId] ?? "").trim() || undefined,
        });

        return { action, result: data as ApprovalResult | null };
      }

      if (action === "reset") {
        const data = await invokeProtectedFunction<ResetResult>("demo-request-reset", {
          body: {
            request_id: requestId,
          },
        });

        return { action, result: data as ResetResult | null };
      }

      const data = await invokeProtectedFunction<RejectResult>("demo-request-reject", {
        body: {
          request_id: requestId,
          review_notes: reviewNotes[requestId] ?? "",
        },
      });

      return { action, result: data as RejectResult | null };
    },
    onSuccess: async ({ action, result }, variables) => {
      if (action === "approved" && result) {
        setApprovalResult(result);
        setInitialPasswords((current) => ({
          ...current,
          [variables.requestId]: "",
        }));
        setActionFeedback((current) => ({
          ...current,
          [variables.requestId]: {
            message: "Approved admin request successfully.",
            tone: "success",
          },
        }));
        toast.success("Approved admin request successfully.");
      } else if (action === "reset") {
        if (approvalResult?.request_id === variables.requestId) {
          setApprovalResult(null);
        }
        setActionFeedback((current) => ({
          ...current,
          [variables.requestId]: {
            message: "Admin request reset for review.",
            tone: "muted",
          },
        }));
        toast.success("Admin request reset to pending review.");
      } else {
        setActionFeedback((current) => ({
          ...current,
          [variables.requestId]: {
            message: "Rejected admin request successfully.",
            tone: "success",
          },
        }));
        toast.success("Rejected admin request successfully.");
      }
      setPendingAction(null);
      await queryClient.invalidateQueries({ queryKey: ["tenant-requests-superadmin"] });
    },
    onError: (mutationError: Error) => {
      setPendingAction(null);
      toast.error(mutationError.message || "Review failed");
    },
  });

  const retryNotificationsMutation = useMutation({
    mutationFn: async () =>
      invokeProtectedFunction<RetryNotificationsResult>("demo-request-notification-retry", {
        body: {},
      }),
    onSuccess: async (result) => {
      toast.success(
        `Retry complete. Sent: ${result.sent_count}, Failed: ${result.failed_count}, Skipped: ${result.skipped_count}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["tenant-requests-superadmin"] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Failed to retry verification emails");
    },
  });

  const getActionCopy = (action: ReviewAction, status: string) => {
    if (action === "approved") {
      return {
        title: "Approve this admin request?",
        description:
          "Approving will provision the admin account, activate the tenant workspace, and mark the issued password as temporary until the tenant resets it.",
        confirmLabel: "Approve Request",
      };
    }

    if (action === "rejected") {
      return {
        title: "Reject this admin request?",
        description: "Are you sure you want to reject this request? The applicant will remain blocked until the request is reset.",
        confirmLabel: "Reject Request",
      };
    }

    return {
      title: "Reset this admin request?",
      description:
        status === "approved"
          ? "This will move the request back to pending review and deactivate the current approved admin access."
          : "This will move the request back to pending review so it can be approved or rejected again.",
      confirmLabel: "Reset Request",
    };
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    if (pendingAction.action === "approved") {
      const initialPassword = (initialPasswords[pendingAction.requestId] ?? "").trim();
      if (initialPassword && initialPassword.length < 8) {
        toast.error("Temporary password must be at least 8 characters.");
        return;
      }
    }
    reviewMutation.mutate({
      requestId: pendingAction.requestId,
      action: pendingAction.action,
    });
  };

  const copyCredentials = async () => {
    if (!approvalResult) return;

    const content = [
      `Email: ${approvalResult.email}`,
      `Temporary Password: ${approvalResult.temp_password}`,
      `Login URL: ${approvalResult.login_url}`,
      "Important: This is a temporary password. The tenant must reset it after the first sign-in.",
    ].join("\n");

    await navigator.clipboard.writeText(content);
    toast.success("Credentials copied.");
  };

  if (!isSuperAdmin) {
    return (
      <Card className="border-amber-300/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Superadmin Only
          </CardTitle>
          <CardDescription>
            Admin approval and provisioning is restricted to the platform superadmin.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {approvalResult && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Admin Provisioned
            </CardTitle>
            <CardDescription>
              Share these credentials securely. The approved tenant package, billing tier, and package-managed limits are now attached to this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><strong>Email:</strong> {approvalResult.email}</div>
            <div><strong>Temporary password:</strong> {approvalResult.temp_password}</div>
            <div><strong>Login URL:</strong> {approvalResult.login_url}</div>
            <div><strong>Email sent:</strong> {approvalResult.approval_email_sent ? "Yes" : "No"}</div>
            <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-3 text-sm text-error">
              This password is temporary. The tenant will see a red security alert and must reset it before continuing.
            </div>
            <Button onClick={copyCredentials} variant="outline">
              Copy Credentials
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle>{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle>{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle>{stats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejected</CardDescription>
            <CardTitle>{stats.rejected}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Admin Requests
              </CardTitle>
              <CardDescription>
                Review admin applications, approve the tenant admin, and provision the workspace with its requested package and billing alignment.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => retryNotificationsMutation.mutate()}
              disabled={retryNotificationsMutation.isPending}
            >
              {retryNotificationsMutation.isPending ? "Retrying..." : "Retry Verification Emails"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-sm text-destructive">Failed to load admin requests: {error.message}</div>
          ) : isLoading ? (
            <div className="text-sm text-muted-foreground">Loading admin requests...</div>
          ) : !visibleRequests.length ? (
            <div className="text-sm text-muted-foreground">No admin requests found.</div>
          ) : (
            <>
              <div className="md:hidden rounded-2xl border border-border/70 bg-background/30 p-3">
                <div className="space-y-3">
                  {visibleRequests.map((request) => {
                    const isPending = request.status === "pending";
                    const isApproving =
                      reviewMutation.isPending &&
                      reviewMutation.variables?.requestId === request.id &&
                      reviewMutation.variables?.action === "approved";
                    const isRejecting =
                      reviewMutation.isPending &&
                      reviewMutation.variables?.requestId === request.id &&
                      reviewMutation.variables?.action === "rejected";
                    const isResetting =
                      reviewMutation.isPending &&
                      reviewMutation.variables?.requestId === request.id &&
                      reviewMutation.variables?.action === "reset";
                    const inlineFeedback = actionFeedback[request.id];

                    return (
                      <div key={request.id} className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold">{request.business_name}</p>
                            <p className="mt-1 truncate text-sm text-muted-foreground">{request.full_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{request.business_type}</p>
                          </div>
                          <RequestStatusBadge status={request.status} />
                        </div>

                        <div className="mt-4 space-y-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span className="truncate">{request.email}</span>
                            </div>
                            <div className="text-muted-foreground">{request.phone}</div>
                            <div className="text-muted-foreground">
                              Requested package: {requestedPackageLabels[request.requested_package ?? "starter"]}
                            </div>
                            {request.requested_domain && (
                              <div className="text-muted-foreground">Requested domain: {request.requested_domain}</div>
                            )}
                          </div>

                          <div className="rounded-lg border border-border/60 px-3 py-3 text-sm">
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                              <span className="text-muted-foreground">Submitted</span>
                              <span className="justify-self-end text-right">{formatDateTime(request.created_at)}</span>
                              {request.reviewed_at && (
                                <>
                                  <span className="text-muted-foreground">Reviewed</span>
                                  <span className="justify-self-end text-right">{formatDateTime(request.reviewed_at)}</span>
                                </>
                              )}
                            </div>
                            <div className="mt-3 space-y-2">
                              <p className="text-muted-foreground">Application</p>
                              <p>{request.message || "-"}</p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border/60 px-3 py-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-muted-foreground">Verification email</span>
                              <NotificationStatusBadge status={request.request_notification_status} />
                            </div>
                            {request.request_notification_sent_at && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Delivered {formatDateTime(request.request_notification_sent_at)}
                              </p>
                            )}
                            {request.request_notification_error && (
                              <div
                                className={`mt-2 rounded-md border px-2 py-2 text-xs ${
                                  request.request_notification_status === "skipped"
                                    ? "border-amber-300/30 bg-amber-100/30 text-amber-800"
                                    : "border-destructive/20 bg-destructive/5 text-destructive"
                                }`}
                              >
                                {formatNotificationError(request.request_notification_error)}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Input
                              placeholder="Optional superadmin note"
                              value={reviewNotes[request.id] ?? ""}
                              onChange={(event) =>
                                setReviewNotes((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              disabled={!isPending || isApproving || isRejecting || isResetting}
                            />
                            <PasswordInput
                              placeholder="Optional temporary password (min 8 chars)"
                              value={initialPasswords[request.id] ?? ""}
                              onChange={(event) =>
                                setInitialPasswords((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              disabled={!isPending || isApproving || isRejecting || isResetting}
                            />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Button
                                onClick={() =>
                                  setPendingAction({
                                    requestId: request.id,
                                    action: "approved",
                                    fullName: request.full_name,
                                    status: request.status,
                                  })
                                }
                                disabled={!isPending || isApproving || isRejecting || isResetting}
                                size="sm"
                              >
                                {isApproving ? "Approving..." : "Approve Tenant"}
                              </Button>
                              <Button
                                onClick={() =>
                                  setPendingAction({
                                    requestId: request.id,
                                    action: "rejected",
                                    fullName: request.full_name,
                                    status: request.status,
                                  })
                                }
                                disabled={!isPending || isApproving || isRejecting || isResetting}
                                size="sm"
                                variant="outline"
                              >
                                {isRejecting ? "Rejecting..." : "Reject"}
                              </Button>
                            </div>
                            {!isPending && (
                              <Button
                                onClick={() =>
                                  setPendingAction({
                                    requestId: request.id,
                                    action: "reset",
                                    fullName: request.full_name,
                                    status: request.status,
                                  })
                                }
                                disabled={isApproving || isRejecting || isResetting}
                                size="sm"
                                variant="ghost"
                                className="w-full justify-center"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset Request
                              </Button>
                            )}
                            {inlineFeedback && (
                              <div
                                className={`text-xs ${
                                  inlineFeedback.tone === "success" ? "text-emerald-600" : "text-muted-foreground"
                                }`}
                              >
                                {inlineFeedback.message}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Application</TableHead>
                      <TableHead>Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRequests.map((request) => {
                      const isPending = request.status === "pending";
                      const isApproving =
                        reviewMutation.isPending &&
                        reviewMutation.variables?.requestId === request.id &&
                        reviewMutation.variables?.action === "approved";
                      const isRejecting =
                        reviewMutation.isPending &&
                        reviewMutation.variables?.requestId === request.id &&
                        reviewMutation.variables?.action === "rejected";
                      const isResetting =
                        reviewMutation.isPending &&
                        reviewMutation.variables?.requestId === request.id &&
                        reviewMutation.variables?.action === "reset";
                      const inlineFeedback = actionFeedback[request.id];

                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="font-medium">{request.full_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {request.email}
                            </div>
                            <div className="text-xs text-muted-foreground">{request.phone}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium flex items-center gap-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {request.business_name}
                            </div>
                            <div className="text-xs text-muted-foreground">{request.business_type}</div>
                            <div className="text-xs text-muted-foreground">
                              Requested package: {requestedPackageLabels[request.requested_package ?? "starter"]}
                            </div>
                            {request.requested_domain && (
                              <div className="text-xs text-muted-foreground">
                                Requested domain: {request.requested_domain}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <RequestStatusBadge status={request.status} />
                            {request.reviewed_at && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatDateTime(request.reviewed_at)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-sm">
                            <div className="text-sm">{request.message || "-"}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Submitted {formatDateTime(request.created_at)}
                            </div>
                            <div className="mt-2 space-y-1 text-xs">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Verification email:</span>
                                <NotificationStatusBadge status={request.request_notification_status} />
                              </div>
                              {request.request_notification_sent_at && (
                                <div className="text-muted-foreground">
                                  Delivered {formatDateTime(request.request_notification_sent_at)}
                                </div>
                              )}
                              {request.request_notification_error && (
                                <div
                                  className={`rounded-md border px-2 py-1 ${
                                    request.request_notification_status === "skipped"
                                      ? "border-amber-300/30 bg-amber-100/30 text-amber-800"
                                      : "border-destructive/20 bg-destructive/5 text-destructive"
                                  }`}
                                >
                                  {formatNotificationError(request.request_notification_error)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="space-y-2">
                            <Input
                              placeholder="Optional superadmin note"
                              value={reviewNotes[request.id] ?? ""}
                              onChange={(event) =>
                                setReviewNotes((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              disabled={!isPending || isApproving || isRejecting || isResetting}
                            />
                            <PasswordInput
                              placeholder="Optional temporary password (min 8 chars)"
                              value={initialPasswords[request.id] ?? ""}
                              onChange={(event) =>
                                setInitialPasswords((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              disabled={!isPending || isApproving || isRejecting || isResetting}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                onClick={() =>
                                  setPendingAction({
                                    requestId: request.id,
                                    action: "approved",
                                    fullName: request.full_name,
                                    status: request.status,
                                  })
                                }
                                disabled={!isPending || isApproving || isRejecting || isResetting}
                                size="sm"
                              >
                                {isApproving ? "Approving..." : "Approve Tenant"}
                              </Button>
                              <Button
                                onClick={() =>
                                  setPendingAction({
                                    requestId: request.id,
                                    action: "rejected",
                                    fullName: request.full_name,
                                    status: request.status,
                                  })
                                }
                                disabled={!isPending || isApproving || isRejecting || isResetting}
                                size="sm"
                                variant="outline"
                              >
                                {isRejecting ? "Rejecting..." : "Reject"}
                              </Button>
                              {!isPending && (
                                <Button
                                  onClick={() =>
                                    setPendingAction({
                                      requestId: request.id,
                                      action: "reset",
                                      fullName: request.full_name,
                                      status: request.status,
                                    })
                                  }
                                  disabled={isApproving || isRejecting || isResetting}
                                  size="icon"
                                  variant="ghost"
                                  title="Reset request"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {inlineFeedback && (
                              <div
                                className={`text-xs ${
                                  inlineFeedback.tone === "success" ? "text-emerald-600" : "text-muted-foreground"
                                }`}
                              >
                                {inlineFeedback.message}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {pendingAction ? getActionCopy(pendingAction.action, pendingAction.status).title : "Confirm action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? getActionCopy(pendingAction.action, pendingAction.status).description : ""}
              {pendingAction ? ` Applicant: ${pendingAction.fullName}.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending && pendingAction
                ? pendingAction.action === "approved"
                  ? "Approving..."
                  : pendingAction.action === "rejected"
                    ? "Rejecting..."
                    : "Resetting..."
                : pendingAction
                  ? getActionCopy(pendingAction.action, pendingAction.status).confirmLabel
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
