import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTenantDetail } from "@/lib/services/tenant.service";
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
import {
  Building2,
  Pencil,
  ArrowLeft,
  Users,
  Package,
  ShoppingCart,
  UserRound,
  Settings,
} from "lucide-react";
import { ToggleTenantButton } from "../_components/toggle-tenant-button";
import { DeleteTenantButton } from "../_components/delete-tenant-button";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSuperAdmin();
  const { slug } = await params;

  const found = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!found) notFound();

  const tenant = await getTenantDetail(found.id);
  if (!tenant) notFound();

  const t = tenant;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tenants">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {t.businessSettings?.businessName ?? t.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Slug: <code className="font-mono">{t.slug}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={t.isActive ? "default" : "destructive"} className="rounded-lg">
            {t.isActive ? "Active" : "Disabled"}
          </Badge>
          <Badge variant="outline" className="capitalize rounded-lg">{t.plan}</Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/tenants/${t.slug}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
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
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Members"
          value={t._count.members}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Employees"
          value={t._count.employees}
          icon={<UserRound className="h-4 w-4" />}
        />
      </div>

      {/* Members */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Members ({t._count.members})
          </CardTitle>
          <CardDescription>
            People with access to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  t.members.map((m) => (
                    <TableRow key={m.user.id}>
                      <TableCell className="font-medium">
                        {m.user.fullName}
                      </TableCell>
                      <TableCell className="text-sm">{m.user.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.user.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize rounded-lg">
                          {m.role}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-primary" />
              Business Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {t.businessSettings ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business Name:</span>
                  <span className="font-medium">{t.businessSettings.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created At:</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated At:</span>
                  <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No business settings configured.</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-primary" />
              System Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {t.systemSettings ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currency:</span>
                  <span className="font-medium">
                    {t.systemSettings.currencyCode} ({t.systemSettings.currencySymbol})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timezone:</span>
                  <span className="font-medium">{t.systemSettings.timezone}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No system settings configured.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
