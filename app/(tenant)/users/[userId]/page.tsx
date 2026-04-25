import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Shield, User as UserIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { requireTenant } from "@/lib/auth";
import {
  canViewOtherUser,
  getProfile,
} from "@/lib/services/profile.service";

function formatRole(role: string | null, isSuperAdmin: boolean): string {
  if (isSuperAdmin) return "Super Admin";
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <div className="flex h-10 items-center rounded-md border border-border/60 bg-muted/30 px-3 text-sm">
        {value || "Not provided"}
      </div>
    </div>
  );
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await requireTenant();

  // Self → just redirect to /profile (editable form). Avoids two views
  // showing the same data with different capabilities.
  if (session.userId === userId) redirect("/profile");

  const allowed = await canViewOtherUser(
    {
      userId: session.userId,
      tenantId: session.tenantId,
      role: session.role,
      isSuperAdmin: session.isSuperAdmin,
    },
    userId
  );
  if (!allowed) redirect("/dashboard");

  const profile = await getProfile(userId, session.tenantId);
  if (!profile) notFound();

  const roleLabel = formatRole(
    profile.roleInCurrentTenant,
    profile.isSuperAdmin
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            {profile.fullName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Read-only view · only the user themselves can edit this profile
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Account details for this user</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField
              label="Full Name"
              value={profile.fullName}
              icon={<UserIcon className="h-4 w-4" />}
            />
            <ReadOnlyField
              label="Email"
              value={profile.email}
              icon={<Mail className="h-4 w-4" />}
            />
            <ReadOnlyField
              label="Phone"
              value={profile.phone ?? ""}
              icon={<Phone className="h-4 w-4" />}
            />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role
              </Label>
              <div className="flex h-10 items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3">
                <Badge variant="default" className="capitalize">
                  {roleLabel}
                </Badge>
                {profile.isSuperAdmin && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    platform
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
