"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ResetRequestButton } from "../../_components/demo-request-actions";

export type ApprovedRow = {
  id: string;
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  requestedPlan: string;
  approvedAt: string; // ISO
};

export function ApprovedRequestsTable({ rows }: { rows: ApprovedRow[] }) {
  const columns: Column<ApprovedRow>[] = [
    {
      key: "business",
      header: "Business",
      className: "font-medium",
      cell: (r) => r.businessName,
    },
    {
      key: "owner",
      header: "Owner",
      cell: (r) => r.fullName,
    },
    {
      key: "email",
      header: "Email",
      className: "text-xs text-muted-foreground",
      cell: (r) => r.email,
    },
    {
      key: "phone",
      header: "Phone",
      className: "text-xs text-muted-foreground",
      cell: (r) => r.phone,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) => (
        <Badge variant="outline" className="capitalize">
          {r.requestedPlan}
        </Badge>
      ),
    },
    {
      key: "approved",
      header: "Approved",
      className: "text-xs text-muted-foreground",
      cell: (r) => new Date(r.approvedAt).toLocaleDateString(),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(r) => r.id}
      selectable={false}
      itemNoun="requests"
      actionsCell={(r) => <ResetRequestButton requestId={r.id} />}
    />
  );
}
