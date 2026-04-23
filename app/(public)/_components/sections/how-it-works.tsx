import { FileText, ShieldCheck, Rocket } from "lucide-react";

const STEPS = [
  {
    icon: FileText,
    number: "01",
    title: "Request access",
    description:
      "Tell us about your business. Takes less than 2 minutes — we'll review and respond within 24 hours.",
  },
  {
    icon: ShieldCheck,
    number: "02",
    title: "Get approved",
    description:
      "Our team reviews your request and provisions a dedicated workspace with your settings preconfigured.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Start managing",
    description:
      "Receive secure login credentials by email. Import your data or start fresh — you'll be productive on day one.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            From sign-up to productive in 24 hours.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Every workspace is reviewed and approved by our team to ensure security
            and quality.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.number} className="relative">
              {/* Connector line (between cards) */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-border to-transparent -translate-x-6 z-0" />
              )}

              <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-3xl font-bold text-muted-foreground/30 leading-none">
                    {step.number}
                  </span>
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
