import { useState } from "react";
import { Boxes, CreditCard, ExternalLink, Loader2, ShoppingCart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { useBilling, PlanKey } from "@/core/billing/useBilling";
import { useUserRole } from "@/core/auth/useUserRole";
import {
  billingPlanDefinitions,
  billingPlanOrder,
  formatPackageLimit,
} from "@/constants/packagePlans";

export const BillingSettings = () => {
  const { planKey, status, isActive, currentPeriodEnd, cancelAtPeriodEnd, isLoading, refetch } = useBilling();
  const { hasPermission } = useUserRole();
  const [isProcessing, setIsProcessing] = useState<PlanKey | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const canViewBilling = hasPermission("billing.view") || hasPermission("billing.edit");
  const canManageBilling = hasPermission("billing.edit");

  const handleUpgrade = async (targetPlan: PlanKey) => {
    if (!canManageBilling) {
      toast.error("You don't have permission to manage billing");
      return;
    }

    setIsProcessing(targetPlan);
    try {
      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: {
          plan_key: targetPlan,
          success_url: `${window.location.origin}/admin?tab=billing&status=success`,
          cancel_url: `${window.location.origin}/admin?tab=billing&status=cancel`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to start checkout");
      }
      if (!data?.url) {
        throw new Error("Checkout session not returned");
      }

      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      toast.error(message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleManageBilling = async () => {
    if (!canManageBilling) {
      toast.error("You don't have permission to manage billing");
      return;
    }

    setIsPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-portal", {
        body: {
          return_url: `${window.location.origin}/admin?tab=billing`,
        },
      });
      if (error) throw new Error(error.message || "Failed to open billing portal");
      if (!data?.url) throw new Error("Billing portal URL missing");
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Portal request failed";
      toast.error(message);
    } finally {
      setIsPortalLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canViewBilling) {
    return null;
  }

  const currentPlan = billingPlanDefinitions[planKey];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing Plan
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Current plan: <span className="font-medium text-foreground">{currentPlan.label}</span>
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Status: {status}</div>
            {currentPeriodEnd && (
              <div>
                Renews: {new Date(currentPeriodEnd).toLocaleDateString()} {cancelAtPeriodEnd ? "(cancels)" : ""}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={planKey === "free" ? "outline" : "default"} className="rounded-full px-3 py-1">
              {currentPlan.priceLabel}
            </Badge>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              {formatPackageLimit(currentPlan.usageLimits.products, "products")}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              {formatPackageLimit(currentPlan.usageLimits.customers, "customers")}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              {formatPackageLimit(currentPlan.usageLimits.sales, "sales")}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{currentPlan.billingDescription}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {isActive ? (
              <Button variant="outline" onClick={handleManageBilling} disabled={isPortalLoading || !canManageBilling}>
                {isPortalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening portal...
                  </>
                ) : (
                  <>
                    Manage Billing
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => refetch()} disabled={!canManageBilling}>
                Refresh Status
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {billingPlanOrder.map((billingPlanKey) => {
          const plan = billingPlanDefinitions[billingPlanKey];
          const isCurrentPlan = planKey === billingPlanKey;
          const isPaidPlan = billingPlanKey !== "free";
          const isFeatured = billingPlanKey === "starter";

          return (
            <Card
              key={billingPlanKey}
              className={`overflow-hidden rounded-3xl border-border/70 ${
                isFeatured ? "border-primary/40 shadow-primary/10" : ""
              }`}
            >
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={isCurrentPlan ? "default" : "outline"} className="rounded-full px-3 py-1">
                      {isCurrentPlan ? "Current" : plan.badge}
                    </Badge>
                    <CardTitle className="mt-4">{plan.label}</CardTitle>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold">{plan.priceLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {plan.monthlyPriceCents > 0 ? "per month" : "no monthly fee"}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{plan.billingDescription}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-primary" />
                    <span>{formatPackageLimit(plan.usageLimits.products, "products")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{formatPackageLimit(plan.usageLimits.customers, "customers")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span>{formatPackageLimit(plan.usageLimits.sales, "sales")}</span>
                  </div>
                </div>

                {isPaidPlan ? (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(billingPlanKey)}
                    disabled={isProcessing === billingPlanKey || !canManageBilling || isCurrentPlan}
                  >
                    {isProcessing === billingPlanKey ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirecting...
                      </>
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : (
                      `Upgrade to ${plan.label}`
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={isPortalLoading || !canManageBilling || !isActive}
                  >
                    {isCurrentPlan ? "Current Starter Plan" : "Manage Billing for Downgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
