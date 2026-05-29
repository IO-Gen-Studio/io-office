import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { AuthContext, type AuthContextValue, type ProfileRow, type ModuleAccessRow } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadAux = async (uid: string) => {
    const [{ data: p }, { data: roles }, { data: ma }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("module_access").select("*").eq("user_id", uid),
    ]);
    setProfile(p as ProfileRow | null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    setModuleAccess((ma as ModuleAccessRow[] | null) ?? []);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => { void loadAux(sess.user.id); }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setModuleAccess([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
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
    isAdmin || moduleAccess.some((m) => m.module === module && m.can_view);
  const canEdit = (module: string) =>
    isAdmin || moduleAccess.some((m) => m.module === module && m.can_edit);

  const refresh = async () => {
    if (user) await loadAux(user.id);
  };

  const value: AuthContextValue = {
    session, user, profile, isAdmin, moduleAccess, loading,
    canView, canEdit, signOut, refresh,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
