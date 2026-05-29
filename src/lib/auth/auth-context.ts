import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type ProfileRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  email: string;
  active: boolean;
  must_change_password: boolean;
};

export type ModuleAccessRow = {
  user_id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
};

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
  moduleAccess: ModuleAccessRow[];
  loading: boolean;
  canView: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
