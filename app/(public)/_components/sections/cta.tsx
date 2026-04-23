import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-accent/10 px-8 py-16 md:px-16 md:py-24">
          <div
            aria-hidden
            className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Ready to take control of your inventory?
            </h2>
            <p className="mt-4 text-base md:text-lg text-muted-foreground">
              Join hundreds of businesses already running their operations on
              RaheDeen. Set up takes less than a day.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/request-demo">
                <Button size="lg" className="h-12 px-6 text-base font-medium">
                  Request access
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base font-medium">
                  Sign in to dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
