"use client";

// Top-bar "view as" switcher for users who hold more than one role. Calls the
// setViewModeAction server action (which sets the cookie + redirects). Labels
// are duplicated here so this client module never imports the server-only
// lib/view-mode (which pulls in prisma).

import { useTransition } from "react";
import { UserCog, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setViewModeAction } from "@/app/continue/actions";

const LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  owner: "Owner",
  admin: "Admin",
  employee: "Employee",
};

export function ViewSwitcher({
  available,
  active,
}: {
  available: string[];
  active: string | null;
}) {
  const [pending, start] = useTransition();
  if (!available || available.length <= 1) return null;

  // With no explicit cookie yet, the effective view is the most-privileged one.
  const current = active ?? available[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Switch view"
          className="flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCog className="h-4 w-4" />
          )}
          <span className="hidden lg:inline">{LABELS[current] ?? current}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>View as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.map((mode) => (
          <DropdownMenuItem
            key={mode}
            disabled={pending || mode === current}
            onSelect={(e) => {
              e.preventDefault();
              if (mode === current) return;
              start(() => setViewModeAction(mode as never));
            }}
            className="flex items-center justify-between"
          >
            <span>{LABELS[mode] ?? mode}</span>
            {mode === current && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
