import Link from "next/link";
import { ArrowRight, Sparkles, ShoppingBag, Truck, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -top-20 -right-20 h-[400px] w-[400px] rounded-full bg-accent/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(to right, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 md:px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 backdrop-blur px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for wholesale and retail businesses
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Run your business with{" "}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              clarity & speed.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Inventory, sales, packaging, customers, invoices and reports — in one
            beautifully simple dashboard. Stop juggling spreadsheets.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/request-demo">
              <Button size="lg" className="h-12 px-6 text-base font-medium">
                Request access
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base font-medium">
                Sign in
              </Button>
            </Link>
          </div>

          {/* Trust */}
          <p className="mt-6 text-xs text-muted-foreground">
            No credit card required · Set up in minutes · Cancel anytime
          </p>
        </div>

        {/* Floating feature pills */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {[
            { icon: ShoppingBag, label: "Inventory" },
            { icon: BarChart3, label: "Reports" },
            { icon: Users, label: "Customers" },
            { icon: Truck, label: "Couriers" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 backdrop-blur px-3 py-2 text-sm font-medium"
            >
              <item.icon className="h-4 w-4 text-primary" />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
