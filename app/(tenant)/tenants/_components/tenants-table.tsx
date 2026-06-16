"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ToggleTenantButton } from "./toggle-tenant-button";
import { DeleteTenantButton } from "./delete-tenant-button";

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  members: number;
  employees: number;
  isActive: boolean;
  createdAt: string; // ISO
};

export function TenantsTable({ rows }: { rows: TenantRow[] }) {
  const columns: Column<TenantRow>[] = [
    {
      key: "business",
      header: "Business",
      className: "font-medium",
      cell: (t) => (
        <Link
          href={`/tenants/${t.slug}`}
          className="text-primary hover:underline"
        >
          {t.name}
        </Link>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      className: "font-mono text-xs text-muted-foreground",
      cell: (t) => t.slug,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (t) => (
        <Badge variant="outline" className="capitalize">
          {t.plan}
        </Badge>
      ),
    },
    {
      key: "members",
      header: "Members",
      headClassName: "text-right",
      className: "text-right",
      cell: (t) => t.members,
    },
    {
      key: "employees",
      header: "Employees",
      headClassName: "text-right",
      className: "text-right",
      cell: (t) => t.employees,
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <Badge variant={t.isActive ? "default" : "destructive"}>
          {t.isActive ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "text-xs text-muted-foreground",
      cell: (t) => new Date(t.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(t) => t.id}
      selectable={false}
      itemNoun="tenants"
      actionsCell={(t) => (
        <>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/tenants/${t.slug}/edit`}>
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <ToggleTenantButton tenantId={t.id} isActive={t.isActive} />
          <DeleteTenantButton
            tenantId={t.id}
            tenantName={t.name}
            tenantSlug={t.slug}
            counts={{ members: t.members, employees: t.employees }}
          />
        </>
      )}
    />
  );
}
