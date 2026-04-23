import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import {
  listDocuments,
  listDocumentCategories,
  getDocumentStats,
} from "@/lib/services/hr/documents.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderLock,
  Plus,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Trash2,
  PenTool,
  FileText,
} from "lucide-react";
import {
  createDocumentAction,
  signDocumentAction,
  deleteDocumentAction,
} from "../actions-phase2";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Employee files, contracts and e-signatures</p>
        </div>
        <Link href="/hr/documents/categories"><Button variant="outline"><Settings className="h-4 w-4" />Categories</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<FileText className="h-4 w-4" />} title="Total Documents" value={stats.total} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} title="Signed" value={stats.signed} variant="success" />
        <StatCard icon={<Clock className="h-4 w-4" />} title="Expiring Soon" value={stats.expiringSoon} variant="warning" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} title="Expired" value={stats.expired} variant="destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderLock className="h-5 w-5 text-primary" />All Documents</CardTitle>
            <CardDescription>{documents.length} on file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FolderLock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No documents yet — upload one on the right →</p>
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
                            <Button variant="ghost" size="icon" className="h-7 w-7">
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
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-destructive">
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

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Upload Document</CardTitle></CardHeader>
          <CardContent>
            <form action={createDocumentAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Employee *</Label>
                <Select name="employeeId" required>
                  <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select name="categoryId">
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? <SelectItem value="_none" disabled>No categories</SelectItem> : categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Document name *</Label>
                <Input id="name" name="name" required placeholder="Employment Contract" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fileUrl" className="text-xs">File URL</Label>
                <Input id="fileUrl" name="fileUrl" type="url" placeholder="https://..." />
                <p className="text-[10px] text-muted-foreground">For now, paste a URL. File upload (S3) is Phase 3 work.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt" className="text-xs">Expiry date</Label>
                <Input id="expiresAt" name="expiresAt" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Upload</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-warning/35 bg-warning/5 p-3 text-xs text-muted-foreground">
        <strong className="text-warning">Phase 1 Note:</strong> Documents store a URL (not the actual file) and use a manual &quot;Mark signed&quot;
        workflow. Real file upload to S3/Supabase Storage and DocuSign / Adobe Sign API integration is Phase 3 work — both need
        provider credentials and configuration.
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, variant }: { icon: React.ReactNode; title: string; value: number; variant?: "success" | "warning" | "destructive" }) {
  const iconBg = variant === "success" ? "bg-success/10 text-success" : variant === "warning" ? "bg-warning/10 text-warning" : variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>{icon}</div>
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value.toLocaleString()}</div></CardContent>
    </Card>
  );
}
