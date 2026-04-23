import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateTenantForm } from "./_components/create-tenant-form";
import { UserPlus, Info } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";

export default async function CreateTenantPage() {
  await requireSuperAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Tenant</h1>
        <p className="text-sm text-muted-foreground">
          Manually provision a new tenant workspace and admin account
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              New Tenant Details
            </CardTitle>
            <CardDescription>
              Fill in the workspace and owner information. The owner will be able to sign in immediately with the password you set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTenantForm />
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="border-border/70 bg-card/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-primary" />
                What happens when you create
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>1. A new <span className="font-medium text-foreground">User</span> record is created with the owner&apos;s details.</p>
              <p>2. A new <span className="font-medium text-foreground">Tenant</span> workspace is provisioned with default settings.</p>
              <p>3. The user is added as <span className="font-medium text-foreground">owner</span> of the tenant.</p>
              <p>4. Default payment method &amp; system settings are seeded.</p>
              <p>5. The user can sign in immediately at <span className="font-mono text-foreground">/login</span>.</p>
            </CardContent>
          </Card>

          <Card className="border-warning/35 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">⚠ Important</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>You won&apos;t be able to see the password again after creation. Make sure to copy and send it to the user securely.</p>
              <p>Use the &ldquo;Generate password&rdquo; button for a strong random password.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
