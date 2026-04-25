"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mobile-only Sign Out card. Desktop already exposes Sign Out via the
// TopBar's right-side cluster; on mobile that cluster is hidden, so the
// Profile page becomes the canonical place to sign out.
export function MobileSignOutButton() {
  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full h-12 justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}
