import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SquarePen } from "lucide-react";
import { EditTenantForm } from "./_components/edit-tenant-form";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSuperAdmin();
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SquarePen className="h-5 w-5 text-primary" />
            Edit Tenant
          </CardTitle>
          <CardDescription>
            Update workspace settings for <span className="font-medium">{tenant.name}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditTenantForm tenant={tenant} />
        </CardContent>
      </Card>
    </div>
  );
}
