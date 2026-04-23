import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  Building2,
  Check,
  Package,
  PackageCheck,
  Palette,
  ShoppingCart,
  Users,
  FileText,
  Bell,
  Settings,
  LogOut,
  Home,
  Shield,
  UserPlus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuBadge,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useAuth } from "@/core/auth/useAuth";
import { useProfile } from "@/core/auth/useProfile";
import { useUserRole } from "@/core/auth/useUserRole";
import { useBusinessSettings } from "@/core/settings/useBusinessSettings";
import { useTenantRequestsRealtime } from "@/core/tenants/useTenantRequestsRealtime";
import { PanelLeft } from "lucide-react";
import { useTheme } from "next-themes";
import {
  applyThemeToDocument,
  DAISY_THEMES,
  getStoredTheme,
  isDarkTheme,
  resolveTheme,
  setStoredTheme,
  type DaisyThemeName,
} from "@/lib/themePreferences";
import { ROLE_LABELS } from "@/types/roles";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home, permissionKey: 'access.dashboard' },
  { title: "Products", url: "/products", icon: Package, permissionKey: 'products.view' },
  { title: "Sales (POS)", url: "/sales", icon: ShoppingCart, permissionKey: 'sales.view' },
  { title: "Packaging", url: "/packaging", icon: PackageCheck, permissionKey: 'packaging.view' },
  { title: "Customers", url: "/customers", icon: Users, permissionKey: 'customers.view' },
  { title: "HR Management", url: "/hr-management", icon: Briefcase, permissionKey: 'hr.view' },
  { title: "Reports", url: "/reports", icon: BarChart3, permissionKey: 'reports.view' },
  { title: "Invoices", url: "/invoices", icon: FileText, permissionKey: 'invoices.view' },
  { title: "Alerts", url: "/alerts", icon: Bell, permissionKey: 'access.alerts' },
];

const superAdminMenuItems = [
  { title: "Home", url: "/super-admin?tab=home", icon: Home },
  { title: "Tenant List", url: "/super-admin?tab=tenants", icon: Building2 },
  { title: "Tenant Requests", url: "/super-admin?tab=tenant-requests", icon: UserPlus },
  { title: "Reports", url: "/super-admin?tab=reports", icon: BarChart3 },
  { title: "Alerts", url: "/super-admin?tab=alerts", icon: Bell },
];

export function AppSidebar() {
  const { state, setOpenMobile, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { setTheme } = useTheme();
  const { profile } = useProfile();
  const { hasPermission, isLoading, userRole, isSuperAdmin } = useUserRole();
  const { businessSettings } = useBusinessSettings();
  const { pendingCount } = useTenantRequestsRealtime();
  const currentPath = location.pathname;
  const currentSearch = location.search;
  const isCollapsed = state === "collapsed";
  const [logoError, setLogoError] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<DaisyThemeName>("forest");

  useEffect(() => {
    setLogoError(false);
  }, [businessSettings?.logo_url]);

  useEffect(() => {
    const persisted = getStoredTheme(user?.id);
    setSelectedTheme(resolveTheme(persisted));
  }, [user?.id]);

  const isActive = (path: string) => {
    if (path.includes("?")) {
      const [pathname, search] = path.split("?");
      return currentPath === pathname && currentSearch === `?${search}`;
    }
    return currentPath === path;
  };
  const userName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const userRoleLabel = userRole ? ROLE_LABELS[userRole] : "No role";
  const profileAvatarUrl =
    profile && typeof profile === "object" && "avatar_url" in profile && typeof profile.avatar_url === "string"
      ? profile.avatar_url
      : "";

  const getNavClass = (path: string) => {
    return isActive(path)
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground";
  };

  const primaryMenuItems = isSuperAdmin
    ? superAdminMenuItems
    : menuItems.filter((item) => hasPermission(item.permissionKey));

  const handleMobileNavClick = () => {
    // Close sidebar on mobile when navigation item is clicked
    setOpenMobile(false);
  };

  const handleThemeChange = (themeName: DaisyThemeName) => {
    setSelectedTheme(themeName);
    applyThemeToDocument(themeName);
    setStoredTheme(themeName, user?.id);
    setTheme(isDarkTheme(themeName) ? "dark" : "light");
  };

  return (
    <Sidebar className="border-r border-sidebar-border/70 bg-sidebar/95" collapsible="icon">
      <SidebarHeader className="px-3 pt-3 pb-2 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          {businessSettings?.logo_url && !logoError ? (
            <img
              src={businessSettings.logo_url}
              alt={businessSettings.business_name || "Rahestock"}
              className="h-10 w-10 rounded-full border border-border/60 bg-base-100 object-cover"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {(businessSettings?.business_name || "Rahestock").charAt(0)}
            </div>
          )}
          {!isCollapsed && (
            <div className="leading-tight">
              <p className="text-[1rem] font-semibold text-sidebar-foreground leading-tight">
                {businessSettings?.business_name || "Rahestock"}
              </p>
              <p className="text-[11px] text-muted-foreground">Inventory Suite</p>
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
              {isLoading ? (
                // Show skeleton items while loading
                Array.from({ length: isSuperAdmin ? 6 : 8 }, (_, i) => (
                  <SidebarMenuItem key={`skeleton-${i}`}>
                    <div className="h-10 bg-muted animate-pulse rounded-md" />
                  </SidebarMenuItem>
                ))
              ) : (
                primaryMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={`flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${getNavClass(item.url)}`}
                        onClick={handleMobileNavClick}
                      >
                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    {isSuperAdmin && item.url.includes("tenant-requests") && pendingCount > 0 && (
                      <SidebarMenuBadge className="right-2 top-1.5 rounded-full bg-primary text-primary-foreground">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))
              )}
              {/* Trash menu item moved to Admin page */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  className="flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                >
                  <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
                  {!isCollapsed && <span>Sign Out</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {!isLoading && isSuperAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/super-admin?tab=settings"
                        className={`flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${getNavClass("/super-admin?tab=settings")}`}
                        onClick={handleMobileNavClick}
                      >
                        <Settings className="h-[18px] w-[18px] flex-shrink-0" />
                        {!isCollapsed && <span>Settings</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/super-admin?tab=administration"
                        className={`flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${getNavClass("/super-admin?tab=administration")}`}
                        onClick={handleMobileNavClick}
                      >
                        <Shield className="h-[18px] w-[18px] flex-shrink-0" />
                        {!isCollapsed && <span>Administration</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}

              {!isLoading && !isSuperAdmin && hasPermission('settings.view_business') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/settings"
                      className={`flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${getNavClass("/settings")}`}
                      onClick={handleMobileNavClick}
                    >
                      <Settings className="h-[18px] w-[18px] flex-shrink-0" />
                      {!isCollapsed && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Admin Panel - Show if user has any admin permission */}
              {!isLoading && !isSuperAdmin && (
                hasPermission('admin.manage_roles') ||
                hasPermission('admin.manage_permissions') ||
                hasPermission('admin.full_backup') ||
                hasPermission('admin.data_restore') ||
                hasPermission('logs.view')
              ) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin"
                        className={`flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${getNavClass("/admin")}`}
                        onClick={handleMobileNavClick}
                      >
                        <Shield className="h-[18px] w-[18px] flex-shrink-0" />
                        {!isCollapsed && <span>Administration</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <HoverCard openDelay={100} closeDelay={80}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className={`mt-1 flex w-full items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-accent/70 ${isCollapsed ? "justify-center px-0" : ""}`}
              aria-label="Change theme"
              title="Theme"
            >
              <Palette className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="truncate font-medium">Theme</span>}
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="right" align="end" className="w-[320px] max-w-[80vw] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Themes</p>
              <span className="text-xs text-muted-foreground">
                {DAISY_THEMES.find((theme) => theme.name === selectedTheme)?.label || selectedTheme}
              </span>
            </div>
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {DAISY_THEMES.map((themeOption) => {
                const isActive = selectedTheme === themeOption.name;
                return (
                  <button
                    key={themeOption.name}
                    type="button"
                    onClick={() => handleThemeChange(themeOption.name)}
                    className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-base-300 bg-base-100 text-base-content hover:border-primary/40"
                    }`}
                  >
                    <span className="truncate pr-2">{themeOption.label}</span>
                    <span className="flex items-center gap-1">
                      {themeOption.swatch.slice(0, 2).map((color) => (
                        <span
                          key={`${themeOption.name}-${color}`}
                          className="h-2.5 w-2.5 rounded-full border border-base-300/70"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      {isActive && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </HoverCardContent>
        </HoverCard>

        <NavLink
          to={isSuperAdmin ? "/super-admin?tab=profile" : "/profile"}
          onClick={handleMobileNavClick}
          className={`mt-2 flex w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 shadow-sm transition-colors hover:bg-sidebar-accent/70 ${isCollapsed ? "justify-center px-0 py-1" : ""}`}
        >
          <Avatar className="h-8 w-8 border border-border/60">
            <AvatarImage src={profileAvatarUrl} alt={userName} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{userName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{userRoleLabel}</p>
            </div>
          )}
        </NavLink>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} className="flex items-center gap-3 rounded-full px-3 py-2">
              <PanelLeft className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>Collapse</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
