import type { ReactNode } from "react";
import { TrendingUp, ShoppingCart, Users, Package } from "lucide-react";

export function ProductPreview() {
  return (
    <section className="py-24 md:py-32 border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Live preview
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Your business at a glance.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Every metric you care about, surfaced the moment you log in.
          </p>
        </div>

        {/* Mock Dashboard */}
        <div className="mt-14 mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur shadow-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">
                rahedeen.app/dashboard
              </span>
            </div>

            {/* Mock dashboard content */}
            <div className="p-6 md:p-8 space-y-5">
              {/* Header */}
              <div className="flex items-baseline justify-between">
                <div>
                  <h3 className="text-xl font-bold">Dashboard</h3>
                  <p className="text-xs text-muted-foreground">Welcome back, Asif</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Last 30 days
                </span>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Revenue" value="৳43.8M" change="+584%" icon={<TrendingUp className="h-3.5 w-3.5" />} />
                <KpiCard label="Orders" value="2,470" change="+447%" icon={<ShoppingCart className="h-3.5 w-3.5" />} />
                <KpiCard label="Customers" value="869" change="+216%" icon={<Users className="h-3.5 w-3.5" />} />
                <KpiCard label="Products" value="247" change="+12" icon={<Package className="h-3.5 w-3.5" />} />
              </div>

              {/* Mini chart */}
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Daily Revenue</p>
                <div className="flex items-end gap-1 h-20">
                  {[40, 65, 50, 75, 45, 80, 60, 90, 70, 85, 55, 95, 75, 100, 80, 70, 88, 65, 78, 92, 60, 85, 70, 95, 88, 72, 90, 65, 80, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-primary"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
                {[
                  { action: "Sale to Akter Faruk", amount: "৳13,800", color: "bg-primary/15 text-primary" },
                  { action: "New customer: Baby Care", amount: "customer", color: "bg-secondary/15 text-secondary" },
                  { action: "Sale to Alif fashion", amount: "৳8,460", color: "bg-primary/15 text-primary" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                    <span className="text-sm">{item.action}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.color}`}>{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-[10px] text-success">{change}</p>
    </div>
  );
}
