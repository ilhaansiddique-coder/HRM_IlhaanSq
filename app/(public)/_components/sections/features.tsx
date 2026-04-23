import {
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Truck,
  Shield,
  PackageOpen,
  Bell,
  Wallet,
} from "lucide-react";

const FEATURES = [
  {
    icon: Package,
    title: "Smart inventory",
    description:
      "Real-time stock tracking with automatic low-stock alerts and variant management.",
  },
  {
    icon: ShoppingCart,
    title: "Point of sale",
    description:
      "Fast checkout with multi-payment support, discounts and instant invoice generation.",
  },
  {
    icon: Users,
    title: "Customer profiles",
    description:
      "Complete history, credit limits, tags and segmentation built into every record.",
  },
  {
    icon: PackageOpen,
    title: "Packaging queue",
    description:
      "Visual queue for orders awaiting packaging — never miss a shipment.",
  },
  {
    icon: Truck,
    title: "Courier integration",
    description:
      "Direct API integration with Steadfast, Pathao and major couriers.",
  },
  {
    icon: BarChart3,
    title: "Reports & analytics",
    description:
      "Period-over-period comparisons, top products, payment breakdowns and trends.",
  },
  {
    icon: Bell,
    title: "Real-time alerts",
    description:
      "Low-stock warnings, pending payments and overdue orders surfaced instantly.",
  },
  {
    icon: Wallet,
    title: "Customer credit",
    description:
      "Track outstanding balances, partial payments and credit limits per customer.",
  },
  {
    icon: Shield,
    title: "Role-based access",
    description:
      "Granular permissions per team member — owner, admin, manager, staff.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Features
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Everything you need.{" "}
            <span className="text-muted-foreground">Nothing you don&apos;t.</span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Built from the ground up for businesses that move fast and need to know
            what&apos;s happening at any moment.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border/60 bg-card/40 p-6 transition-all hover:bg-card/80 hover:border-border hover:shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
