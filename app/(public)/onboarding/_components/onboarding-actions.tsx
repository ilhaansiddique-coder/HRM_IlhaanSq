"use client";

import { signOut } from "next-auth/client";
import { Button } from "@/components/ui/button";

export function OnboardingActions() {
  return (
    <div className="mt-6 flex justify-center">
      <Button
        variant="outline"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    </div>
  );
}
