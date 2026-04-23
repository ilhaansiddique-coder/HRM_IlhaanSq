export type RequestedPackage = "starter" | "professional" | "enterprise";
export type BillingPlanKey = "free" | "starter" | "pro";
export type PackageFeatureIconKey =
  | "approval"
  | "billing"
  | "customers"
  | "products"
  | "sales"
  | "shield"
  | "team";

export interface PackageFeatureLine {
  icon: PackageFeatureIconKey;
  text: string;
}

export interface PackagePlanDefinition {
  requestedPackage: RequestedPackage;
  billingPlanKey: BillingPlanKey;
  label: string;
  badge: string;
  tagline: string;
  description: string;
  priceLabel: string;
  monthlyPriceCents: number;
  usageLimits: {
    products: number | null;
    customers: number | null;
    sales: number | null;
  };
  cardHighlights: PackageFeatureLine[];
  modalDescription: string;
  billingDescription: string;
}

const starterPlan: PackagePlanDefinition = {
  requestedPackage: "starter",
  billingPlanKey: "free",
  label: "Starter",
  badge: "Free",
  tagline: "Free onboarding package for new tenants.",
  description:
    "Start with tenant admin access, superadmin approval, and a lightweight operating limit for early setup.",
  priceLabel: "Free",
  monthlyPriceCents: 0,
  usageLimits: {
    products: 10,
    customers: 10,
    sales: 10,
  },
  cardHighlights: [
    { icon: "shield", text: "Tenant admin access included" },
    { icon: "products", text: "Up to 10 active products" },
    { icon: "customers", text: "Up to 10 active customers" },
    { icon: "sales", text: "Up to 10 sales records" },
    { icon: "approval", text: "Provisioning remains superadmin-approved" },
  ],
  modalDescription:
    "Free package with 10 products, 10 customers, and 10 sales after superadmin approval.",
  billingDescription:
    "Free onboarding package with lightweight operational limits for new tenants.",
};

const professionalPlan: PackagePlanDefinition = {
  requestedPackage: "professional",
  billingPlanKey: "starter",
  label: "Professional",
  badge: "Most Popular",
  tagline: "Paid package for growing wholesale operations.",
  description:
    "Designed for active teams that need more product and customer capacity with paid-plan billing alignment.",
  priceLabel: "$19/mo",
  monthlyPriceCents: 1900,
  usageLimits: {
    products: 100,
    customers: 100,
    sales: null,
  },
  cardHighlights: [
    { icon: "team", text: "Suitable for broader team usage" },
    { icon: "products", text: "Up to 100 active products" },
    { icon: "customers", text: "Up to 100 active customers" },
    { icon: "sales", text: "Unlimited sales records" },
    { icon: "billing", text: "Stored on approval and aligned with billing" },
  ],
  modalDescription:
    "Paid package with 100 products, 100 customers, and unlimited sales after approval.",
  billingDescription:
    "Growth package for wholesale teams with higher catalog capacity and unlimited sales flow.",
};

const enterprisePlan: PackagePlanDefinition = {
  requestedPackage: "enterprise",
  billingPlanKey: "pro",
  label: "Enterprise",
  badge: "Custom",
  tagline: "Custom package for larger organizations.",
  description:
    "Built for larger operations that need full package flexibility, premium support, and no operational caps.",
  priceLabel: "$49/mo",
  monthlyPriceCents: 4900,
  usageLimits: {
    products: null,
    customers: null,
    sales: null,
  },
  cardHighlights: [
    { icon: "team", text: "Intended for complex operations" },
    { icon: "products", text: "Unlimited active products" },
    { icon: "customers", text: "Unlimited active customers" },
    { icon: "sales", text: "Unlimited sales records" },
    { icon: "billing", text: "Provisioning and billing remain superadmin-controlled" },
  ],
  modalDescription:
    "Premium package with unlimited products, customers, and sales after approval.",
  billingDescription:
    "Largest package with unlimited operational capacity and premium billing tier support.",
};

export const requestedPackageOrder: RequestedPackage[] = ["starter", "professional", "enterprise"];
export const billingPlanOrder: BillingPlanKey[] = ["free", "starter", "pro"];

export const requestedPackageDefinitions: Record<RequestedPackage, PackagePlanDefinition> = {
  starter: starterPlan,
  professional: professionalPlan,
  enterprise: enterprisePlan,
};

export const billingPlanDefinitions: Record<BillingPlanKey, PackagePlanDefinition> = {
  free: starterPlan,
  starter: professionalPlan,
  pro: enterprisePlan,
};

export const mapRequestedPackageToBillingPlan = (
  requestedPackage: RequestedPackage,
): BillingPlanKey => requestedPackageDefinitions[requestedPackage].billingPlanKey;

export const formatPackageLimit = (limit: number | null, noun: string): string =>
  limit === null ? `Unlimited ${noun}` : `${limit} ${noun}`;
