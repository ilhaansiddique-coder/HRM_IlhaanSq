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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2 } from "lucide-react";
import { ResetRequestButton } from "../_components/demo-request-actions";

export default async function ApprovedPage() {
  await requireSuperAdmin();
  const requests = await listDemoRequests("approved");

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Approval History
          </CardTitle>
          <CardDescription>All tenant requests that have been approved</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No approved requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.businessName}</TableCell>
                      <TableCell>{r.fullName}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.email}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{r.requestedPlan}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.reviewedAt
                          ? new Date(r.reviewedAt).toLocaleDateString()
                          : new Date(r.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <ResetRequestButton requestId={r.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
