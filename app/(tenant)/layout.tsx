import { cache } from "react";
import { requireTenant } from "@/lib/auth";
import { getCachedBusinessSettings, getCachedSystemSettings } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { TenantShell } from "./_components/tenant-shell";
import { TenantProviders } from "./_components/providers";

// React-scoped memoization — deduplicates the query within a single render pass.
const getPendingTenantCount = cache(async (isSuperAdmin: boolean) => {
  if (!isSuperAdmin) return 0;
  return prisma.demoRequest.count({ where: { status: "pending" } });
});

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireTenant();

  const [businessSettings, systemSettings, pendingTenantCount] = await Promise.all([
    getCachedBusinessSettings(session.tenantId),
    getCachedSystemSettings(session.tenantId),
    getPendingTenantCount(session.isSuperAdmin),
  ]);

  return (
    <TenantProviders
      session={session}
      businessSettings={businessSettings}
      systemSettings={systemSettings}
    >
      <TenantShell
        businessName={businessSettings?.businessName ?? "My Business"}
        userId={session.userId}
        userName={session.name}
        userEmail={session.email}
        role={session.role}
        isSuperAdmin={session.isSuperAdmin}
        pendingTenantCount={pendingTenantCount}
      >
        {children}
      </TenantShell>
    </TenantProviders>
  );
}
