"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NavLink } from "./nav-link";
import { NotificationBell } from "./notification-bell";
import { ViewSwitcher } from "./view-switcher";
import { NotificationPoller } from "./notification-poller";
import { RealtimeProvider } from "./realtime-provider";
import { signOut } from "next-auth/react";
import { OptimisticNavProvider, useOptimisticNav } from "./optimistic-nav";
import type { NotificationItem } from "@/lib/services/notifications.service";
import {
  Home,
  Users,
  Settings,
  LogOut,
  Shield,
  PanelLeft,
  Sun,
  Moon,
  ArrowUp,
  Building2,
  ChevronDown,
  List,
  Menu,
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
  Coffee,
  Calendar,
  Briefcase,
  BookOpen,
  Award,
  Tags,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DateRangePicker } from "./date-range-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  applyThemeToDocument,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  type DaisyThemeName,
} from "@/lib/utils";

// Mobile bottom-nav entries — shown to every authenticated tenant user
// regardless of role. Admin gets appended for owner / admin / superadmin
// roles below. The HR Overview (/hr) is the tenant home.
const baseBottomNavItems = [
  { label: "HR", to: "/hr", icon: UserCog },
  { label: "Profile", to: "/profile", icon: User },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function TenantShell({
  businessName,
  tenantId,
  userId,
  userName,
  userEmail,
  role,
  isSuperAdmin,
  availableViews,
  activeView,
  pendingTenantCount,
  notifications,
  sidebarDefaultOpen,
  children,
}: {
  businessName: string;
  tenantId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string | null;
  isSuperAdmin: boolean;
  availableViews: string[];
  activeView: string | null;
  pendingTenantCount: number;
  notifications: NotificationItem[];
  sidebarDefaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <OptimisticNavProvider>
      <SidebarProvider
        persistKey={`sidebar:state:${userId}`}
        defaultOpen={sidebarDefaultOpen}
      >
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
              availableViews={availableViews}
              activeView={activeView}
              notifications={notifications}
            />
            <main
              className={`flex-1 p-4 lg:p-6 min-w-0 ${
                role === "employee" ? "nav-mb-safe-tall" : "nav-mb-safe"
              }`}
            >
              {children}
            </main>
          </div>
        </div>

        <MobileBottomNav role={role} isSuperAdmin={isSuperAdmin} />
        <RealtimeProvider tenantId={tenantId} />
        <NotificationPoller />
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
  const { state, toggleSidebar, isMobile } = useSidebar();
  const { activePath: pathname } = useOptimisticNav();
  // On mobile the sidebar is a full-width drawer — never render the icon-only
  // collapsed layout there; always show the full menu with labels.
  const isCollapsed = !isMobile && state === "collapsed";

  const isAdmin = role === "owner" || role === "admin" || role === "superadmin";
  const isEmployee = role === "employee";
  const isRouteActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);
  const isInTenantsAdmin = pathname.startsWith("/tenants");
  const [tenantsOpen, setTenantsOpen] = useState(isInTenantsAdmin);
  // Payroll submenu — toggled ONLY by its chevron; clicking the label
  // navigates to /hr/payroll instead of expanding.
  const [payrollOpen, setPayrollOpen] = useState(
    isRouteActive("/hr/payroll/assign")
  );
  // Performance submenu — same chevron-only toggle behaviour as Payroll.
  const [performanceOpen, setPerformanceOpen] = useState(
    isRouteActive("/hr/performance/cycles") ||
      isRouteActive("/hr/performance/goals")
  );
  // Recruitment submenu — same chevron-only toggle behaviour.
  const [recruitmentOpen, setRecruitmentOpen] = useState(
    isRouteActive("/hr/recruitment/jobs") ||
      isRouteActive("/hr/recruitment/candidates")
  );
  // Learning submenu — same chevron-only toggle behaviour.
  const [learningOpen, setLearningOpen] = useState(
    isRouteActive("/hr/learning/courses") ||
      isRouteActive("/hr/learning/enrollments")
  );
  // Documents submenu — same chevron-only toggle behaviour.
  const [documentsOpen, setDocumentsOpen] = useState(
    isRouteActive("/hr/documents/categories")
  );

  // On mobile, open the top-level groups by default so every menu item is
  // visible openly in the drawer. Desktop keeps them collapsed unless you're
  // currently inside that section.
  useEffect(() => {
    if (isMobile) {
      setTenantsOpen(true);
    }
  }, [isMobile]);

  const navClass = (active: boolean) =>
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground";

  // Employee portal: a stripped sidebar with ONLY the employee's own
  // self-service surface — Overview, Attendance, Break Time, Leave, Payslips.
  if (isEmployee) {
    const employeeMenu = [
      { title: "Overview", url: "/employee", icon: Home },
      { title: "Attendance", url: "/hr/attendance", icon: CalendarClock },
      { title: "Break Time", url: "/hr/break", icon: Coffee },
      { title: "Leave", url: "/hr/leave", icon: CalendarDays },
      { title: "Payslips", url: "/employee/payslips", icon: Wallet },
    ];
    return (
      <Sidebar
        data-lenis-prevent
        className="border-r border-sidebar-border/70 bg-sidebar/95"
        collapsible="icon"
      >
        <SidebarHeader className="px-3 py-3 group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:flex-col">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {businessName.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="leading-tight min-w-0 flex-1">
                <p className="text-[1rem] font-semibold text-sidebar-foreground leading-tight truncate">
                  {businessName}
                </p>
                <p className="text-[11px] text-muted-foreground">Employee</p>
              </div>
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isCollapsed ? "Maximize sidebar" : "Minimize sidebar"}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-sidebar-border/70 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/70"
            >
              <PanelLeft
                className={`h-[18px] w-[18px] transition-transform ${
                  isCollapsed ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {employeeMenu.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isRouteActive(item.url)}
                      tooltip={isCollapsed ? item.title : undefined}
                      className={navClass(isRouteActive(item.url))}
                    >
                      <NavLink href={item.url}>
                        <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center transition-colors">
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed && <span>{item.title}</span>}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      data-lenis-prevent
      className="border-r border-sidebar-border/70 bg-sidebar/95"
      collapsible="icon"
    >
      <SidebarHeader className="px-3 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
            {businessName.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="leading-tight min-w-0 flex-1">
              <p className="text-[1rem] font-semibold text-sidebar-foreground leading-tight truncate">
                {businessName}
              </p>
              <p className="text-[11px] text-muted-foreground">Workspace</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Maximize sidebar" : "Minimize sidebar"}
            title={isCollapsed ? "Maximize sidebar" : "Minimize sidebar"}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-sidebar-border/70 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          >
            <PanelLeft
              className={`h-[18px] w-[18px] transition-transform ${
                isCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
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
              {/* HR Module — inline accordion when expanded, flyout dropdown
                  when the sidebar is collapsed to icons. HR Overview (/hr) is
                  the tenant home (the former standalone Dashboard was merged in). */}
              {/* Flat HR menu — every item is a standalone link. "HR" itself
                  is the dashboard home (/hr); the former dropdown groups
                  (Payroll, Performance, etc.) are individual links. */}
              {[
                { href: "/hr", icon: UserCog, label: "HR", active: pathname === "/hr" },
                { href: "/hr/employees", icon: Users, label: "Employees", active: isRouteActive("/hr/employees") },
                { href: "/hr/departments", icon: Building2, label: "Departments", active: isRouteActive("/hr/departments") },
                { href: "/hr/positions", icon: ClipboardCheck, label: "Positions", active: isRouteActive("/hr/positions") },
                { href: "/hr/attendance", icon: CalendarClock, label: "Attendance", active: isRouteActive("/hr/attendance") },
                { href: "/hr/break", icon: Coffee, label: "Break Time", active: isRouteActive("/hr/break") },
                { href: "/hr/leave", icon: CalendarDays, label: "Leave", active: isRouteActive("/hr/leave") },
                { href: "/hr/payroll", icon: Wallet, label: "Payroll", active: isRouteActive("/hr/payroll") },
                { href: "/hr/performance", icon: Target, label: "Performance", active: isRouteActive("/hr/performance") },
                { href: "/hr/recruitment", icon: UserPlus, label: "Recruitment", active: isRouteActive("/hr/recruitment") },
                { href: "/hr/learning", icon: GraduationCap, label: "Learning", active: isRouteActive("/hr/learning") },
                { href: "/hr/documents", icon: FolderLock, label: "Documents", active: isRouteActive("/hr/documents") },
              ].map(({ href, icon: Icon, label, active }) => {
                // Payroll: label navigates to /hr/payroll; chevron (only) opens
                // the Assign Salary submenu.
                if (href === "/hr/payroll") {
                  return (
                    <SidebarMenuItem key={href}>
                      <div className="relative">
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? label : undefined}
                          className={navClass(active)}
                        >
                          <NavLink href={href}>
                            <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 pr-8 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                              <Icon className="h-5 w-5" />
                              {!isCollapsed && <span>{label}</span>}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                        {!isCollapsed && (
                          <button
                            type="button"
                            aria-label="Toggle Payroll submenu"
                            onClick={() => setPayrollOpen((o) => !o)}
                            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${payrollOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                      {payrollOpen && !isCollapsed && (
                        <SidebarMenuSub>
                          <TenantSubLink
                            href="/hr/payroll/assign"
                            icon={<UserPlus className="h-4 w-4" />}
                            label="Assign Salary"
                            active={isRouteActive("/hr/payroll/assign")}
                          />
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }
                // Performance: label navigates to /hr/performance; chevron
                // (only) opens the Cycles + Goals submenu.
                if (href === "/hr/performance") {
                  return (
                    <SidebarMenuItem key={href}>
                      <div className="relative">
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? label : undefined}
                          className={navClass(active)}
                        >
                          <NavLink href={href}>
                            <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 pr-8 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                              <Icon className="h-5 w-5" />
                              {!isCollapsed && <span>{label}</span>}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                        {!isCollapsed && (
                          <button
                            type="button"
                            aria-label="Toggle Performance submenu"
                            onClick={() => setPerformanceOpen((o) => !o)}
                            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${performanceOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                      {performanceOpen && !isCollapsed && (
                        <SidebarMenuSub>
                          <TenantSubLink
                            href="/hr/performance/cycles"
                            icon={<Calendar className="h-4 w-4" />}
                            label="Cycles"
                            active={isRouteActive("/hr/performance/cycles")}
                          />
                          <TenantSubLink
                            href="/hr/performance/goals"
                            icon={<Target className="h-4 w-4" />}
                            label="Goals"
                            active={isRouteActive("/hr/performance/goals")}
                          />
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }
                // Recruitment: label navigates to /hr/recruitment; chevron
                // (only) opens the Jobs + Candidates submenu.
                if (href === "/hr/recruitment") {
                  return (
                    <SidebarMenuItem key={href}>
                      <div className="relative">
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? label : undefined}
                          className={navClass(active)}
                        >
                          <NavLink href={href}>
                            <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 pr-8 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                              <Icon className="h-5 w-5" />
                              {!isCollapsed && <span>{label}</span>}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                        {!isCollapsed && (
                          <button
                            type="button"
                            aria-label="Toggle Recruitment submenu"
                            onClick={() => setRecruitmentOpen((o) => !o)}
                            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${recruitmentOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                      {recruitmentOpen && !isCollapsed && (
                        <SidebarMenuSub>
                          <TenantSubLink
                            href="/hr/recruitment/jobs"
                            icon={<Briefcase className="h-4 w-4" />}
                            label="Jobs"
                            active={isRouteActive("/hr/recruitment/jobs")}
                          />
                          <TenantSubLink
                            href="/hr/recruitment/candidates"
                            icon={<Users className="h-4 w-4" />}
                            label="Candidates"
                            active={isRouteActive("/hr/recruitment/candidates")}
                          />
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }
                // Learning: label navigates to /hr/learning; chevron (only)
                // opens the Courses + Enrollments submenu.
                if (href === "/hr/learning") {
                  return (
                    <SidebarMenuItem key={href}>
                      <div className="relative">
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? label : undefined}
                          className={navClass(active)}
                        >
                          <NavLink href={href}>
                            <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 pr-8 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                              <Icon className="h-5 w-5" />
                              {!isCollapsed && <span>{label}</span>}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                        {!isCollapsed && (
                          <button
                            type="button"
                            aria-label="Toggle Learning submenu"
                            onClick={() => setLearningOpen((o) => !o)}
                            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${learningOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                      {learningOpen && !isCollapsed && (
                        <SidebarMenuSub>
                          <TenantSubLink
                            href="/hr/learning/courses"
                            icon={<BookOpen className="h-4 w-4" />}
                            label="Courses"
                            active={isRouteActive("/hr/learning/courses")}
                          />
                          <TenantSubLink
                            href="/hr/learning/enrollments"
                            icon={<Award className="h-4 w-4" />}
                            label="Enrollments"
                            active={isRouteActive("/hr/learning/enrollments")}
                          />
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }
                // Documents: label navigates to /hr/documents; chevron (only)
                // opens the Categories submenu.
                if (href === "/hr/documents") {
                  return (
                    <SidebarMenuItem key={href}>
                      <div className="relative">
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? label : undefined}
                          className={navClass(active)}
                        >
                          <NavLink href={href}>
                            <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 pr-8 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                              <Icon className="h-5 w-5" />
                              {!isCollapsed && <span>{label}</span>}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                        {!isCollapsed && (
                          <button
                            type="button"
                            aria-label="Toggle Documents submenu"
                            onClick={() => setDocumentsOpen((o) => !o)}
                            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${documentsOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                      {documentsOpen && !isCollapsed && (
                        <SidebarMenuSub>
                          <TenantSubLink
                            href="/hr/documents/categories"
                            icon={<Tags className="h-4 w-4" />}
                            label="Categories"
                            active={isRouteActive("/hr/documents/categories")}
                          />
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={isCollapsed ? label : undefined}
                      className={navClass(active)}
                    >
                      <NavLink href={href}>
                        <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                          <Icon className="h-5 w-5" />
                          {!isCollapsed && <span>{label}</span>}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* SUPER ADMIN ONLY: Tenants management */}
              {isSuperAdmin && (
                <CollapsibleNavGroup
                  icon={Building2}
                  label="Tenants"
                  isActive={isInTenantsAdmin}
                  isCollapsed={isCollapsed}
                  open={tenantsOpen}
                  onOpenChange={setTenantsOpen}
                  triggerClassName={navClass(isInTenantsAdmin)}
                  badge={pendingTenantCount > 0 ? pendingTenantCount : undefined}
                  items={[
                    { href: "/tenants", icon: <List className="h-4 w-4" />, label: "All Tenants", active: pathname === "/tenants" },
                    { href: "/tenants/requests", icon: <Inbox className="h-4 w-4" />, label: "Requests", active: pathname === "/tenants/requests", badge: pendingTenantCount > 0 ? pendingTenantCount : undefined },
                    { href: "/tenants/approved", icon: <CheckCircle2 className="h-4 w-4" />, label: "Approved", active: pathname === "/tenants/approved" },
                    { href: "/tenants/declined", icon: <XCircle className="h-4 w-4" />, label: "Declined", active: pathname === "/tenants/declined" },
                    { href: "/tenants/create", icon: <Plus className="h-4 w-4" />, label: "Create Tenant", active: pathname === "/tenants/create" },
                  ]}
                />
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
                    <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                      <Settings className="h-5 w-5" />
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
                      <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                        <Shield className="h-5 w-5" />
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
  availableViews,
  activeView,
  notifications,
}: {
  userName: string;
  userEmail: string;
  role: string | null;
  availableViews: string[];
  activeView: string | null;
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

  // The date-range picker is only useful on pages with date-filtered data
  // (the Overview analytics). Hide it where it does nothing — e.g. the
  // Positions and Departments lists.
  const { activePath: pathname } = useOptimisticNav();
  const NO_DATE_PICKER = ["/hr/positions", "/hr/departments"];
  const showDatePicker = !NO_DATE_PICKER.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  return (
    <TooltipProvider delayDuration={150}>
      <header className="sticky top-0 z-30 hidden lg:flex items-center gap-1.5 border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur lg:px-6">
        {/* Left — the date-range picker. Shown on most tenant pages (not just
            the dashboard) so the date filter is available; hidden on mobile and
            on pages where it does nothing (see showDatePicker). */}
        <div className="flex flex-1 items-center justify-start">
          {showDatePicker && (
            <div className="hidden lg:block">
              <DateRangePicker />
            </div>
          )}
        </div>

        {/* Page-injected actions (e.g. the Documents "+" upload button) portal
            into this slot so they appear just left of the notification bell. */}
        <div id="topbar-action-slot" className="flex items-center gap-1.5" />

        {/* "View as" switcher — only renders for users holding >1 role. */}
        <ViewSwitcher available={availableViews} active={activeView} />

        {/* Notifications bell — opens a dropdown of recent activity */}
        <NotificationBell notifications={notifications} />

        {/* Theme toggle — single click flips between Light ("light")
            and Dark ("night"). Sun icon shown while in dark mode (a
            click brings the sun back), Moon shown while in light mode
            (a click summons night). */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={
                selectedTheme === "night"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              onClick={() =>
                handleThemeChange(
                  selectedTheme === "night" ? "light" : "night"
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
            >
              {selectedTheme === "night" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {selectedTheme === "night" ? "Light mode" : "Dark mode"}
          </TooltipContent>
        </Tooltip>

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
          <div className="hidden min-w-0 leading-tight lg:block">
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
          className="flex h-9 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 text-sm text-foreground transition-colors hover:bg-muted lg:w-9 lg:justify-center lg:px-0"
        >
          <LogOut className="h-4 w-4" />
          <span className="lg:hidden">Sign Out</span>
        </button>
      </header>
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


function MobileBottomNav({
  role,
  isSuperAdmin,
}: {
  role: string | null;
  isSuperAdmin: boolean;
}) {
  const { activePath: pathname } = useOptimisticNav();
  const { setOpenMobile } = useSidebar();
  const [show, setShow] = useState(true);

  // Build the visible nav set per role:
  //   - everyone: Dashboard, HR, Profile, Settings
  //   - any admin (owner / admin / super admin): + Admin
  // (Tenants is intentionally NOT in the mobile bar — super admins
  //  reach it via the desktop sidebar.)
  const isAdmin =
    role === "owner" || role === "admin" || role === "superadmin" || isSuperAdmin;
  const items =
    role === "employee"
      ? [
          { label: "Overview", to: "/employee", icon: Home },
          { label: "Attendance", to: "/hr/attendance", icon: CalendarClock },
          { label: "Break", to: "/hr/break", icon: Coffee },
          { label: "Leave", to: "/hr/leave", icon: CalendarDays },
          { label: "Payslips", to: "/employee/payslips", icon: Wallet },
          { label: "Profile", to: "/profile", icon: User },
        ]
      : [
          ...baseBottomNavItems,
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
      className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden transition-transform duration-200 gpu pb-safe ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <nav className="flex items-center gap-2 overflow-x-auto border-t border-border/70 bg-card px-3 py-1.5 shadow-[0_-6px_20px_-16px_rgba(0,0,0,0.4)] scrollbar-hide">
        {/* Opens the full sidebar menu as a drawer — gives mobile users the
            complete desktop menu (HR sub-items, Settings, Admin, Tenants…). */}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-label="Open menu"
          className="flex min-w-[64px] flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
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

type NavSubItem = {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  // Optional third level: a sub-link that itself owns sub-links (e.g.
  // HR → Documents → Categories). Rendered as a nested accordion when the
  // sidebar is expanded, and a nested dropdown sub-menu in the collapsed flyout.
  children?: NavSubItem[];
};

// A top-level sidebar entry that owns a set of sub-links (HR, Tenants…).
//
// When the sidebar is EXPANDED it renders the familiar inline accordion.
// When the sidebar is COLLAPSED to icons, an inline accordion is useless —
// the sidebar's own CSS hides `SidebarMenuSub` (group-data-[collapsible=icon]:
// hidden), so clicking the trigger toggled invisible content and the menu
// appeared "dead". In that state we instead anchor the sub-links to the icon
// as a flyout dropdown, which is the standard shadcn collapsed-sidebar pattern.
function CollapsibleNavGroup({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  open,
  onOpenChange,
  triggerClassName,
  badge,
  items,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName: string;
  badge?: number;
  items: NavSubItem[];
}) {
  // Collapsed (icon-only) sidebar: the sub-links can't fit inside the 4rem rail,
  // so clicking the icon opens them as a flyout panel anchored to the icon. It
  // uses the sidebar color tokens (bg-sidebar / border-sidebar-border / sidebar-
  // accent) so it matches the rail in BOTH themes — dark in night mode, light in
  // light mode — instead of looking like a generic popover.
  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={label}
              className={triggerClassName}
            >
              <span className="flex w-full items-center justify-center group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!py-0">
                <Icon className="h-5 w-5 flex-shrink-0" />
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={6}
            className="min-w-52 border-sidebar-border/70 bg-sidebar text-sidebar-foreground shadow-xl"
          >
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-sidebar-border/70" />
            {items.map((item) =>
              item.children && item.children.length > 0 ? (
                <DropdownMenuSub key={item.href}>
                  <DropdownMenuSubTrigger
                    className={
                      item.active
                        ? "cursor-pointer bg-primary/15 text-primary focus:bg-primary/15 focus:text-primary data-[state=open]:bg-primary/15 data-[state=open]:text-primary"
                        : "cursor-pointer text-sidebar-foreground/85 focus:bg-sidebar-accent/70 focus:text-sidebar-foreground data-[state=open]:bg-sidebar-accent/70 data-[state=open]:text-sidebar-foreground"
                    }
                  >
                    <span className="flex w-full items-center gap-2.5 text-[0.8125rem] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:flex-shrink-0">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-44 border-sidebar-border/70 bg-sidebar text-sidebar-foreground shadow-xl">
                    {item.children.map((child) => (
                      <DropdownMenuItem
                        key={child.href}
                        asChild
                        className={
                          child.active
                            ? "cursor-pointer bg-primary/15 text-primary focus:bg-primary/15 focus:text-primary"
                            : "cursor-pointer text-sidebar-foreground/85 focus:bg-sidebar-accent/70 focus:text-sidebar-foreground"
                        }
                      >
                        <NavLink href={child.href}>
                          <span className="flex w-full items-center gap-2.5 text-[0.8125rem] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:flex-shrink-0">
                            {child.icon}
                            <span className="truncate">{child.label}</span>
                          </span>
                        </NavLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  key={item.href}
                  asChild
                  className={
                    item.active
                      ? "cursor-pointer bg-primary/15 text-primary focus:bg-primary/15 focus:text-primary"
                      : "cursor-pointer text-sidebar-foreground/85 focus:bg-sidebar-accent/70 focus:text-sidebar-foreground"
                  }
                >
                  <NavLink href={item.href}>
                    <span className="flex w-full items-center gap-2.5 text-[0.8125rem] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:flex-shrink-0">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge variant="default" className="ml-auto h-5 px-1.5 text-[10px]">
                          {item.badge}
                        </Badge>
                      )}
                    </span>
                  </NavLink>
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  const hasBadge = badge !== undefined && badge > 0;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive} className={triggerClassName}>
            <span className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium">
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{label}</span>
              {hasBadge && (
                <Badge variant="default" className="ml-auto h-5 px-1.5 text-[10px]">
                  {badge}
                </Badge>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""} ${
                  hasBadge ? "" : "ml-auto"
                }`}
              />
            </span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) =>
              item.children && item.children.length > 0 ? (
                <TenantSubGroup key={item.href} item={item} />
              ) : (
                <TenantSubLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={item.active}
                  badge={item.badge}
                />
              )
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// A second-level sub-link that owns its own children (e.g. Documents →
// Categories). Rendered inside the expanded sidebar accordion as a nested
// collapsible; defaults to open whenever the current route is inside it.
function TenantSubGroup({ item }: { item: NavSubItem }) {
  const children = item.children ?? [];
  const childActive = children.some((c) => c.active);
  const [open, setOpen] = useState(item.active || childActive);

  return (
    <SidebarMenuSubItem>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton
            asChild
            isActive={item.active}
            className={
              item.active
                ? "bg-primary/10 text-primary font-medium"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
            }
          >
            <button type="button" className="w-full">
              <span className="flex w-full items-center gap-2.5 text-[0.8125rem] [&>svg]:!h-[18px] [&>svg]:!w-[18px] [&>svg]:flex-shrink-0">
                {item.icon}
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                  className={`ml-auto h-3.5 w-3.5 flex-shrink-0 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <TenantSubLink
                key={child.href}
                href={child.href}
                icon={child.icon}
                label={child.label}
                active={child.active}
                badge={child.badge}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
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
  icon: ReactNode;
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
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
        }
      >
        <NavLink href={href}>
          <span className="flex items-center gap-2.5 w-full text-[0.8125rem] [&>svg]:!h-[18px] [&>svg]:!w-[18px] [&>svg]:flex-shrink-0">
            {icon}
            <span className="truncate">{label}</span>
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
