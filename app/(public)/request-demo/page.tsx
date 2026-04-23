import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import { RequestDemoForm } from "./_components/request-demo-form";

export default function RequestDemoPage() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] py-16 px-4">
      {/* Decorative gradient */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Request access
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Tell us about your business.
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-xl mx-auto">
            Fill in a few details. Our team will review your request and provision a
            workspace within 24 hours.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Form */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 md:p-8">
            <Suspense
              fallback={
                <div className="text-center text-sm text-muted-foreground py-8">
                  Loading form...
                </div>
              }
            >
              <RequestDemoForm />
            </Suspense>
          </div>

          {/* Info sidebar */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <h3 className="font-semibold text-sm">What happens next?</h3>
              <ul className="mt-4 space-y-4">
                <Step
                  icon={<Mail className="h-4 w-4" />}
                  title="Submit request"
                  description="Tell us about your business and your needs."
                />
                <Step
                  icon={<Clock className="h-4 w-4" />}
                  title="We review (within 24h)"
                  description="Our team verifies your request and prepares your workspace."
                />
                <Step
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="You get login details"
                  description="Receive a secure email with your temporary password."
                />
              </ul>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <h3 className="font-semibold text-sm">Already approved?</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Sign in with the credentials we sent you by email.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-block text-sm text-primary hover:underline font-medium"
              >
                Go to sign in →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Step({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </li>
  );
}
