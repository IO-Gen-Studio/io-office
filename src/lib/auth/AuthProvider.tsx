import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { AuthContext, type AuthContextValue, type ProfileRow, type ModuleAccessRow, type TenantRow } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadAux = async (uid: string) => {
    const [{ data: p }, { data: roles }, { data: ma }, { data: sa }, { data: tm }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("module_access").select("*").eq("user_id", uid),
      supabase.from("super_admins").select("user_id").eq("user_id", uid).maybeSingle(),
      supabase.from("tenant_members").select("tenant_id, tenants(id,name,slug,logo_url,active)").eq("user_id", uid),
    ]);
    const profileRow = p as ProfileRow | null;
    if (profileRow && profileRow.active === false) {
      await supabase.auth.signOut();
      setProfile(null); setIsAdmin(false); setIsSuperAdmin(false);
      setModuleAccess([]); setTenants([]);
      navigate({ to: "/login" });
      return;
    }
    const superAdmin = !!sa;
    setIsSuperAdmin(superAdmin);
    setProfile(profileRow);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    setModuleAccess((ma as ModuleAccessRow[] | null) ?? []);

    let tenantList: TenantRow[] = [];
    if (superAdmin) {
      const { data: all } = await supabase.from("tenants").select("*").order("name");
      tenantList = (all as TenantRow[] | null) ?? [];
    } else {
      tenantList = ((tm ?? []) as Array<{ tenants: TenantRow }>).map((r) => r.tenants).filter(Boolean);
    }
    setTenants(tenantList);

    // If no active tenant set, auto-pick first available and persist via RPC
    if (profileRow && !profileRow.active_tenant_id && tenantList.length > 0) {
      await supabase.rpc("set_active_tenant", { _tenant_id: tenantList[0].id } as never);
      const { data: refreshed } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      setProfile(refreshed as ProfileRow | null);
    }
  };

  useEffect(() => {
    let currentUid: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      const nextUser = sess?.user ?? null;
      const nextUid = nextUser?.id ?? null;
      if (nextUid !== currentUid) {
        currentUid = nextUid;
        setUser(nextUser);
        if (nextUid) {
          setTimeout(() => { void loadAux(nextUid); }, 0);
        } else {
          setProfile(null); setIsAdmin(false); setIsSuperAdmin(false);
          setModuleAccess([]); setTenants([]);
        }
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      currentUid = data.session?.user?.id ?? null;
      if (data.session?.user) {
        void loadAux(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const canView = (module: string) =>
    isSuperAdmin || isAdmin || moduleAccess.some((m) => m.module === module && m.can_view && m.tenant_id === profile?.active_tenant_id);
  const canEdit = (module: string) =>
    isSuperAdmin || isAdmin || moduleAccess.some((m) => m.module === module && m.can_edit && m.tenant_id === profile?.active_tenant_id);

  const refresh = async () => { if (user) await loadAux(user.id); };

  const switchTenant = async (tenantId: string) => {
    const { error } = await supabase.rpc("set_active_tenant", { _tenant_id: tenantId } as never);
    if (error) throw error;
    if (user) await loadAux(user.id);
    // Force a hard refresh of cached query data
    window.location.reload();
  };

  const value: AuthContextValue = {
    session, user, profile, isAdmin, isSuperAdmin, moduleAccess, tenants,
    activeTenantId: profile?.active_tenant_id ?? null,
    loading, canView, canEdit, signOut, refresh, switchTenant,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
