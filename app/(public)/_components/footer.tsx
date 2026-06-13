import Link from "next/link";
import { Package } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/40">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Package className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold tracking-tight">
                RaheDeen Inventory
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-md">
              The complete operating system for your wholesale and retail business —
              inventory, sales, customers, packaging and reports in one place.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Product
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#features" className="text-muted-foreground hover:text-foreground">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-muted-foreground hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-muted-foreground hover:text-foreground">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/onboarding" className="text-muted-foreground hover:text-foreground">
                  Request access
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Company
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#faq" className="text-muted-foreground hover:text-foreground">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="mailto:hello@rahedeen.com" className="text-muted-foreground hover:text-foreground">
                  Contact
                </a>
              </li>
              <li>
                <span className="text-muted-foreground">Privacy</span>
              </li>
              <li>
                <span className="text-muted-foreground">Terms</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} RaheDeen Inventory. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built for businesses that value clarity and speed.
          </p>
        </div>
      </div>
    </footer>
  );
}
