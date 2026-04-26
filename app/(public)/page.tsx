import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth";
import { Hero } from "./_components/sections/hero";
import { LogoCloud } from "./_components/sections/logo-cloud";
import { Features } from "./_components/sections/features";
import { ProductPreview } from "./_components/sections/product-preview";
import { HowItWorks } from "./_components/sections/how-it-works";
import { Pricing } from "./_components/sections/pricing";
import { FAQ } from "./_components/sections/faq";
import { CTA } from "./_components/sections/cta";

export default async function LandingPage() {
  // Logged-in users skip the marketing page.
  // Super admins use the same tenant dashboard (with extra Tenants sidebar menu).
  const session = await getOptionalSession();
  if (session) {
    if (session.tenantId) redirect("/dashboard");
    redirect("/onboarding");
  }

  return (
    <>
      <Hero />
      <LogoCloud />
      <Features />
      <ProductPreview />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
