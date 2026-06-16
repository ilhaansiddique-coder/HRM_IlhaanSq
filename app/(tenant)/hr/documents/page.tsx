import type { ReactNode } from "react";
import { requireTenant } from "@/lib/auth";
import {
  listDocuments,
  listDocumentCategories,
  getDocumentStats,
} from "@/lib/services/hr/documents.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard as MetricCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderLock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Trash2,
  PenTool,
  FileText,
} from "lucide-react";
import {
  signDocumentAction,
  deleteDocumentAction,
} from "../actions-phase2";
import { UploadDocumentDialog } from "./_components/upload-document-dialog";

export default async function DocumentsOverviewPage() {
  const session = await requireTenant();
  const [stats, documents, categories, employees] = await Promise.all([
    getDocumentStats(session.tenantId),
    listDocuments(session.tenantId),
    listDocumentCategories(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  return (
    <div className="space-y-6">
      {/* The upload form lives in a dialog opened from the "+" button in the top
          bar (left of the notification bell). This portals its trigger + dialog
          into the TopBar and renders nothing inline here. */}
      <UploadDocumentDialog
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<FileText className="h-4 w-4" />} title="Total Documents" value={stats.total} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} title="Signed" value={stats.signed} variant="success" />
        <StatCard icon={<Clock className="h-4 w-4" />} title="Expiring Soon" value={stats.expiringSoon} variant="warning" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} title="Expired" value={stats.expired} variant="destructive" />
      </div>

      <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderLock className="h-5 w-5 text-primary" />All Documents</CardTitle>
            <CardDescription>{documents.length} on file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FolderLock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No documents yet — click the + button in the top bar to upload.</p>
              </div>
            ) : (
              documents.map((d) => {
                const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
                const expiringSoon = d.expiresAt && !expired && new Date(d.expiresAt) < new Date(Date.now() + 30 * 86400000);
                return (
                  <div key={d.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{d.name}</p>
                          {d.category && <Badge variant="outline" className="text-[10px]">{d.category.name}</Badge>}
                          {d.isSigned && <Badge variant="default" className="text-[10px] gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Signed</Badge>}
                          {expired && <Badge variant="destructive" className="text-[10px]">Expired</Badge>}
                          {expiringSoon && <Badge variant="secondary" className="text-[10px]">Expiring soon</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{d.employee.fullName} ({d.employee.empCode})</p>
                        {d.expiresAt && <p className="text-[10px] text-muted-foreground mt-0.5">Expires {new Date(d.expiresAt).toLocaleDateString()}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {d.fileUrl && (
                          <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        {!d.isSigned && (
                          <form action={signDocumentAction} className="inline">
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="signedByName" value={session.name} />
                            <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Mark as signed">
                              <PenTool className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        )}
                        <form action={deleteDocumentAction} className="inline">
                          <input type="hidden" name="id" value={d.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

      <div className="rounded-lg border border-warning/35 bg-warning/5 p-3 text-xs text-muted-foreground">
        <strong className="text-warning">Note:</strong> Files (PDF, Word, Excel, or image · up to 15MB) are uploaded to secure
        cloud storage. Signing still uses a manual &quot;Mark signed&quot; workflow — DocuSign / Adobe Sign API integration is
        future work that needs provider credentials.
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, variant }: { icon: ReactNode; title: string; value: number; variant?: "success" | "warning" | "destructive" }) {
  return (
    <MetricCard
      icon={icon}
      label={title}
      value={typeof value === "number" ? value.toLocaleString() : value}
      tone={
        variant === "success"
          ? "success"
          : variant === "warning"
          ? "warning"
          : variant === "destructive"
          ? "destructive"
          : "primary"
      }
    />
  );
}
