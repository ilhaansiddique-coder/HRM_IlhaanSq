import Link from "next/link";
import { Mail, KeyRound, XCircle, Clock, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { SetNewPasswordForm } from "./_components/set-new-password-form";

export default async function ResetPasswordWithTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  const status = !record
    ? "invalid"
    : record.type !== "password_reset"
      ? "invalid"
      : record.expiresAt < new Date()
        ? "expired"
        : "valid";

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {status === "invalid" && (
          <Card
            icon={<XCircle className="h-8 w-8" />}
            iconBg="bg-destructive/10 text-destructive"
            title="Invalid reset link"
            description="This password reset link doesn't exist or has already been used. Request a new one to continue."
          />
        )}

        {status === "expired" && (
          <Card
            icon={<Clock className="h-8 w-8" />}
            iconBg="bg-warning/10 text-warning"
            title="Link expired"
            description="Reset links are only valid for 1 hour. Request a new one to continue."
          />
        )}

        {status === "valid" && record && (
          <div>
            <div className="text-center mb-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <KeyRound className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Resetting password for{" "}
                <span className="text-foreground font-medium">{record.email}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-8">
              <SetNewPasswordForm token={token} />
            </div>
          </div>
        )}

        {status !== "valid" && (
          <div className="mt-6 text-center">
            <Link
              href="/reset-password"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              Request a new reset link →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function Card({
  icon,
  iconBg,
  title,
  description,
}: {
  icon: React.ReactNode;
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
