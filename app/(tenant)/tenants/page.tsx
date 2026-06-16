import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { listAllTenants } from "@/lib/services/tenant.service";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Settings } from "lucide-react";
import { ToggleTenantButton } from "./_components/toggle-tenant-button";
import { DeleteTenantButton } from "./_components/delete-tenant-button";
import { TenantsTable, type TenantRow } from "./_components/tenants-table";

export default async function AllTenantsPage() {
  await requireSuperAdmin();
  const tenants = await listAllTenants();

  const totalMembers = tenants.reduce((sum, t) => sum + t._count.members, 0);
  const totalEmployees = tenants.reduce(
    (sum, t) => sum + t._count.employees,
    0
  );
  const activeCount = tenants.filter((t) => t.isActive).length;

  const tenantRows: TenantRow[] = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.businessSettings?.businessName ?? t.name,
    plan: t.plan,
    members: t._count.members,
    employees: t._count.employees,
    isActive: t.isActive,
    createdAt: new Date(t.createdAt).toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-end">
        <Link href="/tenants/create">
          <Button>
            <Plus className="h-4 w-4" />
            Create Tenant
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Tenants" value={tenants.length} />
        <MetricCard label="Active" value={activeCount} variant="success" />
        <MetricCard label="Total Members" value={totalMembers} />
        <MetricCard label="Total Employees" value={totalEmployees} />
      </div>

      {/* Desktop: the project-wide DataTable. Mobile uses the card stack below. */}
      <div className="hidden md:block">
        <TenantsTable rows={tenantRows} />
      </div>

      {/* Mobile: same data as a card stack — business + status header,
          slug + plan, three-col counts grid, created date, then actions. */}
      <div className="md:hidden space-y-3">
        {tenants.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Building2 className="h-8 w-8 opacity-40" />
            <span className="text-sm">No tenants yet. Create one to get started.</span>
          </Card>
        ) : (
          tenants.map((t) => (
            <Card key={t.id} className="rounded-lg p-3 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tenants/${t.slug}`}
                    className="font-medium leading-tight text-primary hover:underline"
                  >
                    {t.businessSettings?.businessName ?? t.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {t.slug}
                  </p>
                </div>
                <Badge
                  variant={t.isActive ? "default" : "destructive"}
                  className="rounded-lg"
                >
                  {t.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <Badge variant="outline" className="rounded-lg capitalize">
                  {t.plan}
                </Badge>
                <span className="ml-auto text-muted-foreground">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Members: </span>
                  <span className="font-semibold">{t._count.members}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Employees: </span>
                  <span className="font-semibold">{t._count.employees}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/tenants/${t.slug}/edit`}>
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
                <ToggleTenantButton tenantId={t.id} isActive={t.isActive} />
                <DeleteTenantButton
                  tenantId={t.id}
                  tenantName={t.businessSettings?.businessName ?? t.name}
                  tenantSlug={t.slug}
                  counts={{
                    members: t._count.members,
                    employees: t._count.employees,
                  }}
                />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "success";
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-3xl font-bold ${variant === "success" ? "text-success" : ""}`}>
          {value.toLocaleString()}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
