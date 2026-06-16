import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { CheckCircle2, XCircle, Clock, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AcceptInviteForm } from "./_components/accept-invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.tenantInvite.findUnique({
    where: { token },
    include: {
      tenant: { select: { name: true, slug: true } },
    },
  });

  const status = !invite
    ? "invalid"
    : invite.expiresAt < new Date()
      ? "expired"
      : "valid";

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {status === "invalid" && (
          <InviteState
            icon={<XCircle className="h-8 w-8" />}
            iconBg="bg-destructive/10 text-destructive"
            title="Invalid invite"
            description="This invite link doesn't exist. Please ask the workspace admin for a new one."
          />
        )}

        {status === "expired" && (
          <InviteState
            icon={<Clock className="h-8 w-8" />}
            iconBg="bg-warning/10 text-warning"
            title="Invite expired"
            description={`This invite to ${invite!.tenant.name} expired on ${new Date(invite!.expiresAt).toLocaleDateString()}. Ask the workspace admin to send a new one.`}
          />
        )}

        {status === "valid" && invite && (
          <div>
            <div className="text-center mb-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">You&apos;re invited!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Join <span className="text-foreground font-medium">{invite.tenant.name}</span> on HRM SaaS
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 mb-6">
              <div className="space-y-3 text-sm">
                <Row label="Workspace" value={invite.tenant.name} />
                <Row label="Email" value={invite.email} />
                <Row
                  label="Role"
                  value={
                    <Badge variant="default" className="capitalize">
                      {invite.role}
                    </Badge>
                  }
                />
                <Row
                  label="Expires"
                  value={new Date(invite.expiresAt).toLocaleDateString()}
                />
              </div>
            </div>

            <AcceptInviteForm token={token} email={invite.email} />
          </div>
        )}
      </div>
    </section>
  );
}

function InviteState({
  icon,
  iconBg,
  title,
  description,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-6 ${iconBg}`}>
        {icon}
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
