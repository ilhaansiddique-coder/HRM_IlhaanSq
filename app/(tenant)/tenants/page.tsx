import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { listAllTenants } from "@/lib/services/tenant.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Building2 } from "lucide-react";
import { ToggleTenantButton } from "./_components/toggle-tenant-button";
import { DeleteTenantButton } from "./_components/delete-tenant-button";

export default async function AllTenantsPage() {
  await requireSuperAdmin();
  const tenants = await listAllTenants();

  const totalMembers = tenants.reduce((sum, t) => sum + t._count.members, 0);
  const totalProducts = tenants.reduce((sum, t) => sum + t._count.products, 0);
  const totalSales = tenants.reduce((sum, t) => sum + t._count.sales, 0);
  const activeCount = tenants.filter((t) => t.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-end">
        <Link href="/super-admin/tenants/create">
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
        <MetricCard label="Total Sales" value={totalSales} />
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>All workspaces on the platform</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No tenants yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.businessSettings?.businessName ?? t.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {t.slug}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{t.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{t._count.members}</TableCell>
                      <TableCell className="text-right">{t._count.products}</TableCell>
                      <TableCell className="text-right">{t._count.sales}</TableCell>
                      <TableCell>
                        <Badge variant={t.isActive ? "default" : "destructive"}>
                          {t.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ToggleTenantButton tenantId={t.id} isActive={t.isActive} />
                          <DeleteTenantButton
                            tenantId={t.id}
                            tenantName={t.businessSettings?.businessName ?? t.name}
                            tenantSlug={t.slug}
                            counts={{
                              members: t._count.members,
                              products: t._count.products,
                              sales: t._count.sales,
                              customers: t._count.customers,
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
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
