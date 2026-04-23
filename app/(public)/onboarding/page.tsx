import { redirect } from "next/navigation";
import { getSession, signOut } from "@/lib/auth";
import { Clock, Mail } from "lucide-react";
import { OnboardingActions } from "./_components/onboarding-actions";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.tenantId) redirect("/dashboard");

  // User is authenticated but has no workspace yet — show pending state
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Clock className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Workspace pending review
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Hi {session.name}, your account is set up but you&apos;re not part of any
          workspace yet. Our team is reviewing your request.
        </p>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 text-left">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">We&apos;ll email you</p>
              <p className="text-xs text-muted-foreground mt-1">
                You&apos;ll receive an email at{" "}
                <span className="text-foreground font-medium">{session.email}</span>{" "}
                as soon as your workspace is ready.
              </p>
            </div>
          </div>
        </div>

        <OnboardingActions />
      </div>
    </section>
  );
}
