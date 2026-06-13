import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listDocumentCategories } from "@/lib/services/hr/documents.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Folder } from "lucide-react";
import { deleteDocCategoryAction } from "../../actions-phase2";
import { NewCategoryDialog } from "./_components/new-category-dialog";

export default async function CategoriesPage() {
  const session = await requireTenant();
  const categories = await listDocumentCategories(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/documents"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {/* The new-category form lives in a dialog opened from the "+" button in
          the top bar (left of the notification bell). This portals its trigger +
          dialog into the TopBar and renders nothing inline here. */}
      <NewCategoryDialog />

      <Card className="border-border/70 bg-card/80">
          <CardHeader><CardTitle>All Employee Contract ({categories.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <Folder className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No categories yet</p>
              </div>
            ) : (
              categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.isRequired && <Badge variant="default" className="text-[10px]">Required</Badge>}
                      <Badge variant="outline" className="text-[10px]">{c._count.documents} docs</Badge>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                    {c.retentionDays && <p className="text-[10px] text-muted-foreground">Retention: {c.retentionDays} days</p>}
                  </div>
                  {c._count.documents === 0 && (
                    <form action={deleteDocCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
    </div>
  );
}
