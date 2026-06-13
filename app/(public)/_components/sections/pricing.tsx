import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    suffix: "forever",
    description: "Perfect for individuals just getting started.",
    features: [
      "Up to 100 products",
      "Up to 200 customers",
      "500 sales / month",
      "Basic reports",
      "1 user account",
      "Email support",
    ],
    cta: "Get started",
    href: "/onboarding",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "৳2,500",
    suffix: "/ month",
    description: "For growing businesses with active operations.",
    features: [
      "Unlimited products",
      "Unlimited customers",
      "Unlimited sales",
      "Advanced reports & analytics",
      "Up to 10 user accounts",
      "Courier integrations",
      "Priority email support",
      "Activity logs",
    ],
    cta: "Request access",
    href: "/onboarding",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    suffix: "pricing",
    description: "For larger teams with custom requirements.",
    features: [
      "Everything in Professional",
      "Unlimited user accounts",
      "Custom integrations",
      "Dedicated account manager",
      "SLA & uptime guarantee",
      "Phone support",
      "On-premise option",
      "Custom training",
    ],
    cta: "Contact sales",
    href: "/onboarding",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Simple plans. No surprises.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Start free. Upgrade when you grow. Cancel anytime.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all ${
                plan.highlighted
                  ? "border-2 border-primary bg-card/80 shadow-xl scale-[1.02] md:scale-105"
                  : "border border-border/60 bg-card/40"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    <Sparkles className="h-3 w-3" />
                    Most popular
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.suffix}</span>
              </div>

              <Link href={plan.href} className="block mt-6">
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        plan.highlighted ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
