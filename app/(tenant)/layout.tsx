import { cache, type ReactNode } from "react";
import { cookies } from "next/headers";
import { requireTenant } from "@/lib/auth";
import { getCachedBusinessSettings, getCachedSystemSettings } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { getRecentNotifications } from "@/lib/services/notifications.service";
import { TenantShell } from "./_components/tenant-shell";
import { TenantProviders } from "./_components/providers";

// React-scoped memoization — deduplicates the query within a single render pass.
const getPendingTenantCount = cache(async (isSuperAdmin: boolean) => {
  if (!isSuperAdmin) return 0;
  // Non-critical badge — a transient DB blip (e.g. Neon cold start) must not
  // reject the layout's Promise.all and 500 every page. Degrade to 0.
  try {
    return await prisma.demoRequest.count({ where: { status: "pending" } });
  } catch (err) {
    console.error("[layout] failed to load pending tenant count:", err);
    return 0;
  }
});

export default async function TenantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireTenant();

  // Source the sidebar's open/closed state from a per-user cookie, written
  // by SidebarProvider's setOpen on every toggle. Reading it here means SSR
  // and the client's first paint render the same tree — no post-hydration
  // flip, no click-eating reconciliation window. Defaults to expanded
  // (true) only when there's no cookie yet (first visit / fresh browser).
  const sidebarCookieName = `sidebar:state:${session.userId}`;
  const sidebarCookie = (await cookies()).get(sidebarCookieName)?.value;
  const sidebarDefaultOpen = sidebarCookie === undefined
    ? true
    : sidebarCookie === "true";

  const [
    businessSettings,
    systemSettings,
    pendingTenantCount,
    notifications,
    freshUser,
  ] = await Promise.all([
    getCachedBusinessSettings(session.tenantId),
    getCachedSystemSettings(session.tenantId),
    getPendingTenantCount(session.isSuperAdmin),
    getRecentNotifications(
      session.isSuperAdmin ? null : session.tenantId,
      session.userId,
      12
    ),
    // Read fullName/email fresh from the DB on every render — the
    // NextAuth JWT carries these but they're frozen at login. Without
    // this re-read, the TopBar would keep showing the old name even
    // after the user updates their profile.
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { fullName: true, email: true },
    }),
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
        userName={freshUser?.fullName ?? session.name}
        userEmail={freshUser?.email ?? session.email}
        role={session.role}
        isSuperAdmin={session.isSuperAdmin}
        pendingTenantCount={pendingTenantCount}
        notifications={notifications}
        sidebarDefaultOpen={sidebarDefaultOpen}
      >
        {children}
      </TenantShell>
    </TenantProviders>
  );
}
