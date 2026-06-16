import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  getAvailableViews,
  viewLanding,
  VIEW_LABELS,
  VIEW_DESCRIPTIONS,
} from "@/lib/view-mode";
import { ShieldCheck, Building2, Briefcase, User, ArrowRight } from "lucide-react";
import { setViewModeAction } from "./actions";

const ICONS = {
  superadmin: ShieldCheck,
  owner: Building2,
  admin: Briefcase,
  employee: User,
} as const;

export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await requireAuth();
  if (session.mustResetPassword) redirect("/change-password");

  const next = (await searchParams).next;
  const views = await getAvailableViews(session);

  // Nothing to choose between → go straight in.
  if (views.length <= 1) {
    const only = views[0];
    redirect(only ? next || viewLanding(only) : next || "/hr");
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Continue as…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hi {session.name}, you can use this account in more than one way.
            Pick how you&apos;d like to continue.
          </p>
        </div>

        <div className="space-y-3">
          {views.map((mode) => {
            const Icon = ICONS[mode];
            return (
              <form key={mode} action={setViewModeAction.bind(null, mode)}>
                <button
                  type="submit"
                  className="group flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-muted"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{VIEW_LABELS[mode]}</p>
                    <p className="text-xs text-muted-foreground">
                      {VIEW_DESCRIPTIONS[mode]}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          You can switch views any time from the top bar.
        </p>
      </div>
    </section>
  );
}
