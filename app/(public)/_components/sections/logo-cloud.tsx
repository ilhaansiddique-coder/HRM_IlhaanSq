import {
  Shirt,
  ShoppingBag,
  Smartphone,
  Utensils,
  Home,
  Sparkles,
} from "lucide-react";

const INDUSTRIES = [
  { icon: Shirt, label: "Fashion & Apparel" },
  { icon: ShoppingBag, label: "General Retail" },
  { icon: Smartphone, label: "Electronics" },
  { icon: Utensils, label: "F&B / Grocery" },
  { icon: Home, label: "Home & Lifestyle" },
  { icon: Sparkles, label: "Beauty & Cosmetics" },
];

export function LogoCloud() {
  return (
    <section className="border-y border-border/60 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Built for every kind of shop
        </p>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 items-center gap-4">
          {INDUSTRIES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/40 px-3 py-3 text-xs font-medium text-muted-foreground"
            >
              <Icon className="h-4 w-4 text-primary/80 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
