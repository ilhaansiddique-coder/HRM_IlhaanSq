import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon,
  features,
  phase,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden relative">
        <div
          aria-hidden
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />
        <CardHeader className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Coming in {phase}
            </Badge>
          </div>
          <CardTitle className="text-2xl">Module under development</CardTitle>
          <CardDescription className="text-base">
            This module is part of the HR roadmap and will be available soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Planned Features
            </h3>
            <ul className="grid sm:grid-cols-2 gap-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <p className="text-sm">
              <span className="font-semibold">Need this sooner?</span>{" "}
              <span className="text-muted-foreground">
                Tell us your priorities — we ship faster on customer-validated modules.
              </span>
            </p>
          </div>

          <Link href="/hr">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to HR Overview
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
