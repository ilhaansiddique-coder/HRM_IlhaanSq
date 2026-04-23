"use client";

import Link from "next/link";
import {
  BarChart3,
  Package,
  Plus,
  ShoppingCart,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DateRangePicker } from "./date-range-picker";

export function DashboardToolbar() {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center justify-between gap-2">
        {/* Left — date range picker with presets + custom range */}
        <DateRangePicker />

        {/* Right — quick action icons */}
        <div className="flex items-center gap-1.5">
          <ActionIconLink href="/sales" label="Sales">
            <ShoppingCart className="h-4 w-4" />
          </ActionIconLink>
          <ActionIconLink href="/reports" label="Reports">
            <BarChart3 className="h-4 w-4" />
          </ActionIconLink>
          <ActionIconLink href="/customers" label="Customers">
            <Users className="h-4 w-4" />
          </ActionIconLink>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg border-border/60 bg-card/40"
                    aria-label="Create new"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Create new</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Quick create
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/sales/new" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>New Sale</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/products" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>New Product</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/customers" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  <span>New Customer</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ActionIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href}>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-lg border-border/60 bg-card/40"
            aria-label={label}
          >
            {children}
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
