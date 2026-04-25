"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NavLink } from "./nav-link";
import { NewSaleDialog } from "./new-sale-dialog";
import { NotificationBell } from "./notification-bell";
import { ProductDialog } from "../products/_components/product-dialog";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { OptimisticNavProvider, useOptimisticNav } from "./optimistic-nav";
import type { NotificationItem } from "@/lib/services/notifications.service";
import {
  Home,
  Package,
  Warehouse,
  ShoppingCart,
  PackageCheck,
  Users,
  FileText,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Shield,
  PanelLeft,
  Palette,
  Check,
  ArrowUp,
  Building2,
  ChevronDown,
  List,
  Inbox,
  CheckCircle2,
  XCircle,
  Plus,
  UserCog,
  CalendarClock,
  CalendarDays,
  Wallet,
  Target,
  UserPlus,
  GraduationCap,
  FolderLock,
  ClipboardCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "../dashboard/_components/date-range-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  applyThemeToDocument,
  DAISY_THEMES,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  type DaisyThemeName,
} from "@/lib/utils";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Products", url: "/products", icon: Package },
  { title: "Inventory", url: "/inventory", icon: Warehouse },
  { title: "Sales", url: "/sales", icon: ShoppingCart },
  { title: "Packaging", url: "/packaging", icon: PackageCheck },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Alerts", url: "/alerts", icon: Bell },
];

// Always-visible mobile bottom-nav entries — shown to every authenticated
// tenant user regardless of role.
const baseBottomNavItems = [
  { label: "Dashboard", to: "/dashboard", icon: Home },
  { label: "Products", to: "/products", icon: Package },
  { label: "Sales", to: "/sales", icon: ShoppingCart },
  { label: "Customers", to: "/customers", icon: Users },
  { label: "Reports", to: "/reports", icon: BarChart3 },
];

export function TenantShell({
  businessName,
  userId,
  userName,
  userEmail,
  role,
  isSuperAdmin,
  pendingTenantCount,
  notifications,
  children,
}: {
  businessName: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string | null;
  isSuperAdmin: boolean;
  pendingTenantCount: number;
  notifications: NotificationItem[];
  children: ReactNode;
}) {
  return (
    <OptimisticNavProvider>
      <SidebarProvider persistKey={`sidebar:state:${userId}`}>
        <div className="flex min-h-screen w-full">
          <AppSidebar
            businessName={businessName}
            role={role}
            isSuperAdmin={isSuperAdmin}
            pendingTenantCount={pendingTenantCount}
          />
          <div className="flex-1 flex flex-col min-w-0 bg-card">
            <TopBar
              userName={userName}
              userEmail={userEmail}
              role={role}
              notifications={notifications}
            />
            <main className="flex-1 p-4 pb-24 md:p-6 min-w-0">{children}</main>
          </div>
        </div>

        <MobileBottomNav role={role} isSuperAdmin={isSuperAdmin} />
      </SidebarProvider>
    </OptimisticNavProvider>
  );
}

function AppSidebar({
  businessName,
  role,
  isSuperAdmin,
  pendingTenantCount,
}: {
  businessName: string;
  role: string | null;
  isSuperAdmin: boolean;
  pendingTenantCount: number;
}) {
  const { state, toggleSidebar } = useSidebar();
  const { activePath: pathname } = useOptimisticNav();
  const isCollapsed = state === "collapsed";

  const isAdmin = role === "owner" || role === "admin" || role === "superadmin";
  const isRouteActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);
  const isInTenantsAdmin = pathname.startsWith("/tenants");
  const [tenantsOpen, setTenantsOpen] = useState(isInTenantsAdmin);
  const isInHr = pathname.startsWith("/hr");
  const [hrOpen, setHrOpen] = useState(isInHr);

  const navClass = (active: boolean) =>
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground";

  return (
    <Sidebar
      data-lenis-prevent
      className="border-r border-sidebar-border/70 bg-sidebar/95"
      collapsible="icon"
    >
      <SidebarHeader className="px-3 pt-3 pb-2 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
            {businessName.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="leading-tight min-w-0">
              <p className="text-[1rem] font-semibold text-sidebar-foreground leading-tight truncate">
                {businessName}
              </p>
              <p className="text-[11px] text-muted-foreground">Workspace</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mb-2" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {!isCollapsed && "Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isRouteActive(item.url)}
                    tooltip={isCollapsed ? item.title : undefined}
                    className={navClass(isRouteActive(item.url))}
                  >
                    <NavLink href={item.url}>
                      <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors">
                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* HR Module — collapsible */}
              <Collapsible open={hrOpen} onOpenChange={setHrOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isInHr}
                      tooltip={isCollapsed ? "HR" : undefined}
                      className={navClass(isInHr)}
                    >
                      <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium w-full">
                        <UserCog className="h-[18px] w-[18px] flex-shrink-0" />
                        {!isCollapsed && (
                          <>
                            <span>HR</span>
                            <ChevronDown
                              className={`h-4 w-4 ml-auto transition-transform ${
                                hrOpen ? "rotate-180" : ""
                              }`}
                            />
                          </>
                        )}
                      </span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!isCollapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <TenantSubLink href="/hr" icon={<Home className="h-4 w-4" />} label="Overview" active={pathname === "/hr"} />
                        <TenantSubLink href="/hr/employees" icon={<Users className="h-4 w-4" />} label="Employees" active={pathname.startsWith("/hr/employees")} />
                        <TenantSubLink href="/hr/departments" icon={<Building2 className="h-4 w-4" />} label="Departments" active={pathname.startsWith("/hr/departments")} />
                        <TenantSubLink href="/hr/positions" icon={<ClipboardCheck className="h-4 w-4" />} label="Positions" active={pathname.startsWith("/hr/positions")} />
                        <TenantSubLink href="/hr/attendance" icon={<CalendarClock className="h-4 w-4" />} label="Attendance" active={pathname.startsWith("/hr/attendance")} />
                        <TenantSubLink href="/hr/leave" icon={<CalendarDays className="h-4 w-4" />} label="Leave" active={pathname.startsWith("/hr/leave")} />
                        <TenantSubLink href="/hr/payroll" icon={<Wallet className="h-4 w-4" />} label="Payroll" active={pathname.startsWith("/hr/payroll")} />
                        <TenantSubLink href="/hr/performance" icon={<Target className="h-4 w-4" />} label="Performance" active={pathname.startsWith("/hr/performance")} />
                        <TenantSubLink href="/hr/recruitment" icon={<UserPlus className="h-4 w-4" />} label="Recruitment" active={pathname.startsWith("/hr/recruitment")} />
                        <TenantSubLink href="/hr/learning" icon={<GraduationCap className="h-4 w-4" />} label="Learning" active={pathname.startsWith("/hr/learning")} />
                        <TenantSubLink href="/hr/documents" icon={<FolderLock className="h-4 w-4" />} label="Documents" active={pathname.startsWith("/hr/documents")} />
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              {/* SUPER ADMIN ONLY: Tenants management */}
              {isSuperAdmin && (
                <Collapsible open={tenantsOpen} onOpenChange={setTenantsOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isInTenantsAdmin}
                        tooltip={isCollapsed ? "Tenants" : undefined}
                        className={navClass(isInTenantsAdmin)}
                      >
                        <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium w-full">
                          <Building2 className="h-[18px] w-[18px] flex-shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span>Tenants</span>
                              {pendingTenantCount > 0 && (
                                <Badge variant="default" className="ml-auto h-5 px-1.5 text-[10px]">
                                  {pendingTenantCount}
                                </Badge>
                              )}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  tenantsOpen ? "rotate-180" : ""
                                } ${pendingTenantCount > 0 ? "" : "ml-auto"}`}
                              />
                            </>
                          )}
                        </span>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!isCollapsed && (
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <TenantSubLink
                            href="/tenants"
                            icon={<List className="h-4 w-4" />}
                            label="All Tenants"
                            active={pathname === "/tenants"}
                          />
                          <TenantSubLink
                            href="/tenants/requests"
                            icon={<Inbox className="h-4 w-4" />}
                            label="Requests"
                            active={pathname === "/tenants/requests"}
                            badge={pendingTenantCount > 0 ? pendingTenantCount : undefined}
                          />
                          <TenantSubLink
                            href="/tenants/approved"
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            label="Approved"
                            active={pathname === "/tenants/approved"}
                          />
                          <TenantSubLink
                            href="/tenants/declined"
                            icon={<XCircle className="h-4 w-4" />}
                            label="Declined"
                            active={pathname === "/tenants/declined"}
                          />
                          <TenantSubLink
                            href="/tenants/create"
                            icon={<Plus className="h-4 w-4" />}
                            label="Create Tenant"
                            active={pathname === "/tenants/create"}
                          />
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    )}
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/settings")}
                  tooltip={isCollapsed ? "Settings" : undefined}
                  className={navClass(isRouteActive("/settings"))}
                >
                  <NavLink href="/settings">
                    <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium">
                      <Settings className="h-[18px] w-[18px]" />
                      {!isCollapsed && <span>Settings</span>}
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isRouteActive("/admin")}
                    tooltip={isCollapsed ? "Administration" : undefined}
                    className={navClass(isRouteActive("/admin"))}
                  >
                    <NavLink href="/admin">
                      <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium">
                        <Shield className="h-[18px] w-[18px]" />
                        {!isCollapsed && <span>Administration</span>}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={isCollapsed ? "Expand sidebar" : undefined}
              className="flex items-center gap-3 rounded-md px-3 py-2"
            >
              <PanelLeft className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>Collapse</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// ─── TopBar ─────────────────────────────────────────────────
// Global header above page content. Shows on every tenant page.
// Holds the user-account controls that used to live in the
// SidebarFooter: theme picker, identity pill, sign-out button.
function TopBar({
  userName,
  userEmail,
  role,
  notifications,
}: {
  userName: string;
  userEmail: string;
  role: string | null;
  notifications: NotificationItem[];
}) {
  const roleLabel = formatRole(role);
  const [selectedTheme, setSelectedTheme] = useState<DaisyThemeName>("light");

  useEffect(() => {
    setSelectedTheme(resolveTheme(getStoredTheme()));
  }, []);

  const handleThemeChange = (name: DaisyThemeName) => {
    setSelectedTheme(name);
    applyThemeToDocument(name);
    setStoredTheme(name);
  };

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Show the dashboard's date range picker in the TopBar's left slot
  // when we're on the dashboard route — keeps everything in one row.
  const { activePath } = useOptimisticNav();
  const isDashboard = activePath === "/dashboard";

  // Cart icon in the TopBar opens the New Sale dialog rather than
  // navigating to /sales. The dialog is rendered alongside the header
  // so the Tooltip+Button composition stays clean.
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-border/60 bg-card/80 px-4 backdrop-blur md:px-6">
        {/* Left — page-specific controls (currently dashboard date picker) */}
        <div className="flex flex-1 items-center justify-start">
          {isDashboard && <DateRangePicker />}
        </div>

        {/* Notifications bell — opens a dropdown of recent activity */}
        <NotificationBell notifications={notifications} />

        {/* Quick navigation shortcuts */}
        {/* Cart icon = New Sale trigger; dialog is rendered after the header */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setNewSaleOpen(true)}
              className="h-9 w-9 rounded-full border-border/60 bg-background/80"
              aria-label="New Sale"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New Sale</TooltipContent>
        </Tooltip>
        <ToolbarIconLink href="/reports" label="Reports">
          <BarChart3 className="h-4 w-4" />
        </ToolbarIconLink>
        <ToolbarIconLink href="/customers" label="Customers">
          <Users className="h-4 w-4" />
        </ToolbarIconLink>

        {/* + icon = Add Product trigger; dialog rendered below the header */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAddProductOpen(true)}
              className="h-9 w-9 rounded-full border-border/60 bg-background/80"
              aria-label="Add Product"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Add Product</TooltipContent>
        </Tooltip>

        {/* Theme picker */}
      <HoverCard openDelay={100} closeDelay={80}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label="Theme"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
          >
            <Palette className="h-4 w-4" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="end"
          className="w-[320px] max-w-[80vw] p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Themes
            </p>
            <span className="text-xs text-muted-foreground">
              {DAISY_THEMES.find((t) => t.name === selectedTheme)?.label ??
                selectedTheme}
            </span>
          </div>
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {DAISY_THEMES.map((t) => {
              const active = selectedTheme === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleThemeChange(t.name)}
                  className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-base-300 bg-base-100 text-base-content hover:border-primary/40"
                  }`}
                >
                  <span className="truncate pr-2">{t.label}</span>
                  <span className="flex items-center gap-1">
                    {t.swatch.slice(0, 2).map((c) => (
                      <span
                        key={c}
                        className="h-2.5 w-2.5 rounded-full border border-base-300/70"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    {active && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </HoverCardContent>
      </HoverCard>

        {/* User identity pill — clicking it opens the profile page.
            Name + role on top, email kept on hover via title attribute. */}
        <Link
          href="/profile"
          title={userEmail}
          className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 shadow-sm transition-colors hover:bg-muted"
        >
          <Avatar className="h-7 w-7 border border-border/60">
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 leading-tight md:block">
            <p className="truncate text-xs font-medium">{userName}</p>
            {roleLabel && (
              <p className="truncate text-[10px] text-muted-foreground">
                {roleLabel}
              </p>
            )}
          </div>
        </Link>

        {/* Sign out — icon-only on md+, icon + label on mobile. */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign Out"
          title="Sign Out"
          className="flex h-9 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 text-sm text-foreground transition-colors hover:bg-muted md:w-9 md:justify-center md:px-0"
        >
          <LogOut className="h-4 w-4" />
          <span className="md:hidden">Sign Out</span>
        </button>
      </header>

      {/* New Sale dialog — controlled by the cart icon in the header */}
      <NewSaleDialog open={newSaleOpen} onOpenChange={setNewSaleOpen} />

      {/* Add Product dialog — controlled by the + icon in the header.
          Reuses the same ProductDialog the products page uses. */}
      <ProductDialog
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
      />
    </TooltipProvider>
  );
}

// Format a role string for display under the user's name in the TopBar.
//   "superadmin" → "Super Admin"
//   "owner"      → "Owner"
//   null / ""    → null  (caller skips rendering)
function formatRole(role: string | null): string | null {
  if (!role) return null;
  if (role === "superadmin") return "Super Admin";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Pill-shaped icon link used in the TopBar's quick-shortcut group.
function ToolbarIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href}>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-border/60 bg-background/80"
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

function MobileBottomNav({
  role,
  isSuperAdmin,
}: {
  role: string | null;
  isSuperAdmin: boolean;
}) {
  const { activePath: pathname } = useOptimisticNav();
  const [show, setShow] = useState(true);

  // Build the visible nav set per role:
  //   - everyone: Dashboard, Products, Sales, Customers, Reports
  //   - super admin: + Tenants (cross-tenant management)
  //   - any admin (owner / admin / super admin): + Admin
  const isAdmin =
    role === "owner" || role === "admin" || role === "superadmin" || isSuperAdmin;
  const items = [
    ...baseBottomNavItems,
    ...(isSuperAdmin ? [{ label: "Tenants", to: "/tenants", icon: Building2 }] : []),
    ...(isAdmin ? [{ label: "Admin", to: "/admin", icon: Shield }] : []),
  ];

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y <= 0) setShow(true);
        else if (delta > 10) setShow(false);
        else if (delta < -10) setShow(true);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-200 ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <nav className="flex items-center gap-2 overflow-x-auto border-t border-border/70 bg-card/95 px-3 py-1.5 shadow-[0_-6px_20px_-16px_rgba(0,0,0,0.4)] backdrop-blur scrollbar-hide">
        {items.map(({ label, to, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <NavLink
              key={to}
              href={to}
              className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors flex-shrink-0 ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full">{label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex min-w-[64px] flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <ArrowUp className="h-5 w-5" />
          <span>Top</span>
        </button>
      </nav>
    </div>
  );
}

function TenantSubLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={active}
        className={
          active
            ? "bg-primary/15 text-primary font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70"
        }
      >
        <NavLink href={href}>
          <span className="flex items-center gap-2 w-full">
            {icon}
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
              <Badge variant="default" className="ml-auto h-5 px-1.5 text-[10px]">
                {badge}
              </Badge>
            )}
          </span>
        </NavLink>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
