"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Package,
  Plus,
  ShoppingCart,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

export function DashboardToolbar() {
  const router = useRouter();
  const params = useSearchParams();
  const range = params.get("range") ?? "today";

  function setRange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "today") next.delete("range");
    else next.set("range", value);
    const query = next.toString();
    router.push(`/dashboard${query ? `?${query}` : ""}`);
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center justify-between gap-2">
        {/* Left — date range selector */}
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-10 w-auto gap-2 rounded-lg border-border/60 bg-card/40 pl-3 pr-2 font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
