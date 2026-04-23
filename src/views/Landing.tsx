import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CreditCard,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DemoRequestModal,
  type DemoRequestPackage,
} from "@/components/landing/DemoRequestModal";
import {
  formatPackageLimit,
  requestedPackageDefinitions,
  requestedPackageOrder,
  type PackageFeatureIconKey,
} from "@/constants/packagePlans";

const featureCards = [
  {
    title: "Inventory Management",
    description: "Track stock levels across warehouse and store locations in real time.",
    icon: Boxes,
  },
  {
    title: "Point of Sale",
    description: "Fast sales entry with invoice support and payment tracking.",
    icon: ShoppingCart,
  },
  {
    title: "Customer Management",
    description: "Maintain ledgers, purchase history, and due collections.",
    icon: Users,
  },
  {
    title: "Role-Based Access",
    description: "Grant precise permissions by role and responsibility.",
    icon: ShieldCheck,
  },
  {
    title: "Reports & Analytics",
    description: "Monitor sales, stock health, and profitability trends.",
    icon: BarChart3,
  },
  {
    title: "Courier Tracking",
    description: "Sync courier statuses and monitor delivery outcomes.",
    icon: Truck,
  },
];

const packageFeatureIcons: Record<PackageFeatureIconKey, typeof ShieldCheck> = {
  approval: UserCheck,
  billing: CreditCard,
  customers: Users,
  products: Boxes,
  sales: ShoppingCart,
  shield: ShieldCheck,
  team: Users,
};

const Landing = () => {
  const { user, loading } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<DemoRequestPackage>("starter");

  const openDemoRequestModal = (requestedPackage: DemoRequestPackage = "starter") => {
    setSelectedPackage(requestedPackage);
    setIsDemoModalOpen(true);
  };

  if (!loading && !roleLoading && user) {
    return <Navigate to={isSuperAdmin ? "/super-admin?tab=tenant-requests" : "/dashboard"} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold">RaheDeen Inventory</h1>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button onClick={() => openDemoRequestModal()}>Request for demo</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Wholesale SaaS Platform
          </p>
          <h2 className="mx-auto max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
            Complete Wholesale Inventory & POS Platform
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
            Multi-vendor, role-based, real-time. Built for wholesale businesses that need control.
          </p>
          <p className="mx-auto my-6 max-w-2xl text-sm text-muted-foreground">
            New businesses can apply for registration and request their preferred domain from here.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => openDemoRequestModal()}>
              Request for demo
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-12">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <h3 className="mb-6 text-center text-2xl font-semibold">How It Works</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>1. Apply for Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Submit your business details and requested domain.</CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>2. Superadmin Review</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>The superadmin validates your request and provisions your admin account.</CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>3. Start Managing</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Run inventory, POS, reporting, and courier tracking from one panel.</CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="pricing" className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Packages</p>
            <h3 className="mt-3 text-3xl font-semibold sm:text-4xl">Choose a package that matches your tenant stage</h3>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">
              Starter stays free, Professional and Enterprise follow paid billing, and every request is still reviewed by superadmin before provisioning.
            </p>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            {requestedPackageOrder.map((packageKey) => {
              const plan = requestedPackageDefinitions[packageKey];
              const isFeatured = packageKey === "professional";
              const accentClassName =
                packageKey === "starter"
                  ? "from-emerald-500/20 via-emerald-500/5 to-transparent"
                  : packageKey === "professional"
                    ? "from-primary/25 via-primary/10 to-transparent"
                    : "from-amber-500/20 via-amber-500/10 to-transparent";

              return (
                <Card
                  key={plan.requestedPackage}
                  className={`relative overflow-hidden rounded-3xl border-border/70 shadow-sm transition-all ${
                    isFeatured ? "border-primary/40 shadow-primary/10" : ""
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${accentClassName}`} />
                  <CardHeader className="relative space-y-5 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge variant={isFeatured ? "default" : "outline"} className="rounded-full px-3 py-1">
                          {plan.badge}
                        </Badge>
                        <CardTitle className="mt-4 text-2xl">{plan.label}</CardTitle>
                        <CardDescription className="mt-2 text-sm text-muted-foreground">
                          {plan.tagline}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black tracking-tight">{plan.priceLabel}</div>
                        <div className="text-xs text-muted-foreground">
                          {plan.monthlyPriceCents > 0 ? "per month" : "no monthly fee"}
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{plan.description}</p>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-center">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Products</div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatPackageLimit(plan.usageLimits.products, "products")}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-center">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Customers</div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatPackageLimit(plan.usageLimits.customers, "customers")}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-center">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Sales</div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatPackageLimit(plan.usageLimits.sales, "sales")}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-5">
                    <div className="space-y-3">
                      {plan.cardHighlights.map((highlight) => {
                        const HighlightIcon = packageFeatureIcons[highlight.icon];
                        return (
                          <div
                            key={highlight.text}
                            className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-3"
                          >
                            <div className="rounded-full bg-primary/10 p-2 text-primary">
                              <HighlightIcon className="h-4 w-4" />
                            </div>
                            <p className="text-sm text-muted-foreground">{highlight.text}</p>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      className="w-full rounded-2xl"
                      variant={isFeatured ? "default" : "outline"}
                      onClick={() => openDemoRequestModal(plan.requestedPackage)}
                    >
                      Request {plan.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Usage caps are enforced only for tenants placed on the package-managed billing flow during approval or later package changes.
          </p>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto flex flex-col gap-3 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>RaheDeen Inventory - Multi-vendor wholesale operations platform</p>
          <div className="flex gap-4">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <button onClick={() => openDemoRequestModal()}>Request Access</button>
            <Link to="/login">Login</Link>
          </div>
        </div>
      </footer>

      <DemoRequestModal
        open={isDemoModalOpen}
        onOpenChange={setIsDemoModalOpen}
        initialRequestedPackage={selectedPackage}
      />
    </div>
  );
};

export default Landing;
