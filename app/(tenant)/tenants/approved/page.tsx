import { requireSuperAdmin } from "@/lib/auth";
import { listDemoRequests } from "@/lib/services/demo-request.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { ResetRequestButton } from "../_components/demo-request-actions";
import {
  ApprovedRequestsTable,
  type ApprovedRow,
} from "./_components/approved-requests-table";

export default async function ApprovedPage() {
  await requireSuperAdmin();
  const requests = await listDemoRequests("approved");

  const approvedRows: ApprovedRow[] = requests.map((r) => ({
    id: r.id,
    businessName: r.businessName,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    requestedPlan: r.requestedPlan,
    approvedAt: new Date(r.reviewedAt ?? r.updatedAt).toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Desktop: the project-wide DataTable. Mobile uses the card stack below. */}
      <div className="hidden md:block space-y-3">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Approval History
          </p>
          <p className="text-xs text-muted-foreground">
            All tenant requests that have been approved
          </p>
        </div>
        <ApprovedRequestsTable rows={approvedRows} />
      </div>

      {/* Mobile: same data as a card stack — business + plan header,
          owner, email, phone, approved date, and a reset action. */}
      <div className="md:hidden space-y-3">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Approval History
          </p>
          <p className="text-xs text-muted-foreground">
            All tenant requests that have been approved
          </p>
        </div>
        {requests.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 opacity-40" />
            <span className="text-sm">No approved requests yet</span>
          </Card>
        ) : (
          requests.map((r) => (
            <Card key={r.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{r.businessName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.fullName}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-lg capitalize">
                  {r.requestedPlan}
                </Badge>
              </div>

              <div className="mt-3 space-y-1 text-xs">
                <div className="break-all">
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium">{r.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="font-medium">{r.phone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Approved: </span>
                  <span className="font-medium">
                    {r.reviewedAt
                      ? new Date(r.reviewedAt).toLocaleDateString()
                      : new Date(r.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <ResetRequestButton requestId={r.id} />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
