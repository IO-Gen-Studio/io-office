import { createFileRoute, Outlet, Link, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Mail, CalendarDays, Megaphone, Briefcase, CreditCard,
  Bell, Settings, LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logoUrl from "@/assets/io-gen-logo.png";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; module?: string }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, module: "calendar" },
];
const BIZ_DEV = [
  { to: "/crm", label: "CRM", icon: Users, module: "crm" },
  { to: "/outreach", label: "Email Outreach", icon: Mail, module: "outreach" },
  { to: "/social", label: "Social Planner", icon: Megaphone, module: "social" },
];
const OPS = [
  { to: "/projects", label: "Projects & Works", icon: Briefcase, module: "projects" },
  { to: "/subscriptions", label: "Subscriptions", icon: CreditCard, module: "subscriptions" },
];

function AuthLayout() {
  const { profile, signOut, canView, isAdmin, isSuperAdmin, user, loading, tenants, activeTenantId, switchTenant } = useAuth();
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!loading && profile?.must_change_password && !redirectedRef.current) {
      redirectedRef.current = true;
      void navigate({ to: "/reset-password" });
    }
  }, [loading, profile?.must_change_password, navigate]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).is("read_at", null).eq("user_id", userId);
      setUnread(count ?? 0);
    };
    void load();
    const channel = supabase.channel(`notif:${userId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      () => void load(),
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <AppSidebar canView={canView} isAdmin={isAdmin || isSuperAdmin} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur flex items-center px-4 gap-2 sticky top-0 z-10">
            <SidebarTrigger />
            {tenants.length > 0 && (
              tenants.length === 1 && !isSuperAdmin ? (
                <span className="text-sm font-medium ml-2 truncate max-w-[200px]">{tenants[0].name}</span>
              ) : (
                <Select value={activeTenantId ?? undefined} onValueChange={(v) => { void switchTenant(v); }}>
                  <SelectTrigger className="w-[220px] h-8 ml-2"><SelectValue placeholder="Select organisation" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{!t.active && " (disabled)"}</SelectItem>)}
                  </SelectContent>
                </Select>
              )
            )}
            <div className="flex-1" />
            <Link to="/notifications" className="p-2 rounded-md hover:bg-accent relative">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </Badge>
              )}
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {(profile?.full_name || user?.email || "U").slice(0,2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm">{profile?.full_name || user?.email}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle>Account</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-1">
                  <div className="px-3 py-2 text-xs text-muted-foreground">{profile?.email}</div>
                  <Link to="/settings/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">Profile</Link>
                  {isAdmin && <Link to="/settings/users" className="block rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">User management</Link>}
                  <button onClick={() => signOut()} className="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </header>
          <main className="flex-1 overflow-auto"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ canView, isAdmin }: { canView: (m: string) => boolean; isAdmin: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => path === p || path.startsWith(p + "/");

  const renderGroup = (label: string, items: typeof NAV) => {
    const visible = items.filter((i) => !i.module || canView(i.module));
    if (!visible.length) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild isActive={isActive(item.to)}>
                  <Link to={item.to} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-3 flex items-center gap-2">
          <img src={logoUrl} alt="Logo" className="size-8 rounded-md object-contain shrink-0" />
          {!collapsed && <div className="font-semibold tracking-tight"> </div>}
        </div>
        {renderGroup("Overview", NAV)}
        {renderGroup("Business Development", BIZ_DEV)}
        {renderGroup("Operations", OPS)}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/settings")}>
                    <Link to="/settings/profile" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Settings</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
