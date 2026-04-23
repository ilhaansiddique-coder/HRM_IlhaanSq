import { ReactNode } from "react";
import { useBilling, PlanKey } from "@/core/billing/useBilling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { billingPlanDefinitions } from "@/constants/packagePlans";

const planRank: Record<PlanKey, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

interface BillingGateProps {
  minPlan?: PlanKey;
  children: ReactNode;
  title?: string;
  description?: string;
}

export const BillingGate = ({
  minPlan = "starter",
  children,
  title = "Upgrade Required",
  description,
}: BillingGateProps) => {
  const { planKey, isActive } = useBilling();
  const targetPlan = billingPlanDefinitions[minPlan];

  if (isActive && planRank[planKey] >= planRank[minPlan]) {
    return <>{children}</>;
  }

  const handleUpgrade = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: {
          plan_key: minPlan,
          success_url: `${window.location.origin}/admin?tab=billing&status=success`,
          cancel_url: `${window.location.origin}/admin?tab=billing&status=cancel`,
        },
      });
      if (error) throw new Error(error.message || "Failed to start checkout");
      if (!data?.url) throw new Error("Checkout URL missing");
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {description ?? `This feature is available on the ${targetPlan.label} package or above.`}
        </p>
        <Button onClick={handleUpgrade}>Upgrade to {targetPlan.label}</Button>
      </CardContent>
    </Card>
  );
};
