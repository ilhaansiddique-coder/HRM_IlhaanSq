import { requireTenant } from "@/lib/auth";
import { listSalaryStructures } from "@/lib/services/hr/payroll.service";
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
import { Layers, Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  createSalaryStructureAction,
  addSalaryComponentAction,
  deleteSalaryComponentAction,
} from "../../actions-phase2";

export default async function StructuresPage() {
  const session = await requireTenant();
  const structures = await listSalaryStructures(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/payroll"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {structures.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No structures yet. Create one to start.</p>
              </CardContent>
            </Card>
          ) : (
            structures.map((s) => (
              <Card key={s.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <CardDescription>
                        {s.components.length} component{s.components.length !== 1 ? "s" : ""} · {s._count.assignments} employee{s._count.assignments !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                    {s.isActive && <Badge variant="default">Active</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {s.components.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-3">No components yet — add some below.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {s.components.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant={c.type === "earning" ? "default" : "destructive"} className="text-[10px] capitalize">{c.type}</Badge>
                            <span className="font-medium">{c.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">({c.code})</span>
                            {c.isStatutory && <Badge variant="outline" className="text-[10px]">Statutory</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              {c.calculationType === "fixed" ? `${Number(c.value).toLocaleString()}` : `${Number(c.value)}% of ${c.calculationType === "percent_of_basic" ? "basic" : "gross"}`}
                            </span>
                            <form action={deleteSalaryComponentAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add component form */}
                  <form action={addSalaryComponentAction} className="grid gap-2 grid-cols-2 pt-3 border-t border-border/60">
                    <input type="hidden" name="structureId" value={s.id} />
                    <Input name="name" placeholder="Component name (HRA)" required minLength={2} className="col-span-1" />
                    <Input name="code" placeholder="Code (HRA)" required maxLength={10} className="col-span-1 font-mono uppercase" />
                    <Select name="type" defaultValue="earning">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="earning">Earning</SelectItem>
                        <SelectItem value="deduction">Deduction</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select name="calculationType" defaultValue="fixed">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="percent_of_basic">% of Basic</SelectItem>
                        <SelectItem value="percent_of_gross">% of Gross</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input name="value" type="number" step="0.01" placeholder="Value" required className="col-span-2" />
                    <Button type="submit" className="col-span-2" size="sm">
                      <Plus className="h-4 w-4" /> Add component
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />New Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createSalaryStructureAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Name <span className="text-destructive">*</span></Label>
                <Input id="name" name="name" required minLength={2} placeholder="Standard Staff" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Create</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
