"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

export type MemberRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
};

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const columns: Column<MemberRow>[] = [
    {
      key: "name",
      header: "Name",
      className: "font-medium",
      cell: (m) => m.fullName,
    },
    {
      key: "email",
      header: "Email",
      className: "text-sm",
      cell: (m) => m.email,
    },
    {
      key: "phone",
      header: "Phone",
      className: "text-sm text-muted-foreground",
      cell: (m) => m.phone,
    },
    {
      key: "role",
      header: "Role",
      cell: (m) => (
        <Badge variant="outline" className="capitalize rounded-lg">
          {m.role}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(m) => m.id}
      selectable={false}
      itemNoun="members"
    />
  );
}
