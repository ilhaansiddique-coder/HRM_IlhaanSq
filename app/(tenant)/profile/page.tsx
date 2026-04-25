import { redirect } from "next/navigation";
import { User as UserIcon } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { requireTenant } from "@/lib/auth";
import { getProfile } from "@/lib/services/profile.service";
import { ProfileForm } from "./_components/profile-form";
import { SecurityForm } from "./_components/security-form";

function formatRole(role: string | null, isSuperAdmin: boolean): string {
  if (isSuperAdmin) return "Super Admin";
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default async function ProfilePage() {
  const session = await requireTenant();
  const profile = await getProfile(session.userId, session.tenantId);
  if (!profile) redirect("/login");

  const roleLabel = formatRole(
    profile.roleInCurrentTenant,
    profile.isSuperAdmin
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            {profile.fullName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your account details and password
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1 p-1 sm:w-auto">
          <TabsTrigger
            value="profile"
            className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"
          >
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm
            initial={{
              fullName: profile.fullName,
              email: profile.email,
              phone: profile.phone ?? "",
              roleLabel,
              isSuperAdmin: profile.isSuperAdmin,
            }}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
