import { requireSuperAdmin } from "@/lib/auth";
import type { ReactNode } from "react";
import { listDemoRequests } from "@/lib/services/demo-request.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, Mail, Phone, Calendar, MessageSquare, Globe } from "lucide-react";
import { DemoRequestActions } from "../_components/demo-request-actions";

export default async function RequestsPage() {
  await requireSuperAdmin();
  const requests = await listDemoRequests("pending");

  return (
    <div className="space-y-6">
      {requests.length === 0 ? (
        <Card className="border-border/70 bg-card/40">
          <CardContent className="py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
              <Inbox className="h-8 w-8 text-success" />
            </div>
            <h3 className="font-semibold">All caught up</h3>
            <p className="text-sm text-muted-foreground mt-1">
              New tenant requests will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="border-border/70 bg-card/80 overflow-hidden">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{req.businessName}</CardTitle>
                      <Badge variant="outline" className="text-xs capitalize">
                        {req.requestedPlan}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {req.businessType}
                      </Badge>
                    </div>
                    <CardDescription>Requested by {req.fullName}</CardDescription>
                  </div>
                  <DemoRequestActions requestId={req.id} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={req.email} />
                  <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={req.phone} />
                  {req.requestedSlug && (
                    <InfoRow
                      icon={<Globe className="h-3.5 w-3.5" />}
                      label="Requested URL"
                      value={`rahedeen.app/${req.requestedSlug}`}
                      mono
                    />
                  )}
                  <InfoRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Submitted"
                    value={new Date(req.createdAt).toLocaleString()}
                  />
                </div>
                {req.message && (
                  <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Message
                    </div>
                    <p className="text-sm italic">&ldquo;{req.message}&rdquo;</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
