import { requireSuperAdmin } from "@/lib/auth";
import { listDemoRequests } from "@/lib/services/demo-request.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { XCircle, MessageSquare } from "lucide-react";
import { ResetRequestButton } from "../_components/demo-request-actions";

export default async function DeclinedPage() {
  await requireSuperAdmin();
  const requests = await listDemoRequests("rejected");

  return (
    <div className="space-y-6">
      {requests.length === 0 ? (
        <Card className="border-border/70 bg-card/40">
          <CardContent className="py-16 text-center">
            <XCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No declined requests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="border-border/70 bg-card/80">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <CardTitle className="text-base">{r.businessName}</CardTitle>
                      <Badge variant="destructive" className="text-xs">Declined</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{r.requestedPlan}</Badge>
                    </div>
                    <CardDescription>
                      {r.fullName} · {r.email} · {r.phone}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-xs text-muted-foreground">
                      Declined {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : "—"}
                    </div>
                    <ResetRequestButton requestId={r.id} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.message && (
                  <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Original message
                    </div>
                    <p className="text-sm italic">&ldquo;{r.message}&rdquo;</p>
                  </div>
                )}
                {r.rejectionReason && (
                  <div className="rounded-lg border border-destructive/35 bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-destructive mb-1 font-medium">
                      <XCircle className="h-3.5 w-3.5" />
                      Rejection note (internal)
                    </div>
                    <p className="text-sm">{r.rejectionReason}</p>
                  </div>
                )}
                {!r.rejectionReason && (
                  <p className="text-xs text-muted-foreground italic">No rejection note provided.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
