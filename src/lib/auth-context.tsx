/* Real Supabase auth, employee-code based.
 *
 * - Login: resolve employee_code -> email via server fn, then signInWithPassword.
 * - Session: onAuthStateChange + initial getSession() (set listener FIRST).
 * - Profile: fetched from public.profiles, mapped to the existing User shape.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveEmployeeEmail } from "@/lib/auth.functions";
import type { Role, User } from "./types";
import { ROLE_LABEL } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (code: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  acknowledge: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  allUsers: User[];
  refreshProfile: () => Promise<void>;
  refreshAllUsers: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

const AVATAR_COLORS = [
  "#F2994A",
  "#F2C94C",
  "#27AE60",
  "#2D9CDB",
  "#9B51E0",
  "#EB5757",
  "#56CCF2",
  "#BB6BD9",
];

function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type ProfileRow = {
  id: string;
  auth_user_id: string;
  full_name: string;
  employee_code: string;
  email: string;
  phone: string | null;
  role: Role;
  avatar_url: string | null;
  is_active: boolean;
  has_accepted_terms: boolean;
  accepted_terms_at: string | null;
};

function mapProfile(p: ProfileRow): User {
  return {
    id: p.id,
    authUserId: p.auth_user_id,
    employeeCode: p.employee_code,
    name: p.full_name,
    role: p.role,
    email: p.email,
    phone: p.phone ?? undefined,
    avatarColor: colorFromId(p.id),
    avatarUrl: p.avatar_url,
    jobTitle: ROLE_LABEL[p.role],
    isActive: p.is_active,
    acknowledged: p.has_accepted_terms,
    acknowledgedAt: p.accepted_terms_at ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUserId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) {
      console.error("profile load error", error);
      return null;
    }
    return data ? mapProfile(data as ProfileRow) : null;
  }, []);

  const refreshAllUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("users load error", error);
      return;
    }
    setAllUsers(((data as ProfileRow[]) ?? []).map(mapProfile));
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const u = await loadProfile(data.user.id);
    if (u) setUser(u);
  }, [loadProfile]);

  useEffect(() => {
    // 1. Set listener FIRST (avoid missing the SIGNED_IN event)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // defer Supabase calls to avoid deadlocks in the callback
        setTimeout(async () => {
          const u = await loadProfile(session.user.id);
          setUser(u);
          if (u) await refreshAllUsers();
        }, 0);
      } else {
        setUser(null);
        setAllUsers([]);
      }
    });

    // 2. Then check the existing session
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const u = await loadProfile(data.session.user.id);
        setUser(u);
        if (u) await refreshAllUsers();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, refreshAllUsers]);

  const login = useCallback(async (code: string, password: string) => {
    const { email } = await resolveEmployeeEmail({
      data: { employeeCode: code.trim() },
    });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Invalid employee code or password");

    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) throw new Error("Sign-in failed");
    const u = await loadProfile(sess.user.id);
    if (!u) throw new Error("Profile not found for this user");
    setUser(u);
    return u;
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAllUsers([]);
  }, []);

  const acknowledge = useCallback(async () => {
    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        has_accepted_terms: true,
        accepted_terms_at: new Date().toISOString(),
      })
      .eq("auth_user_id", sess.user.id);
    if (error) {
      console.error(error);
      throw new Error("Could not record acknowledgement");
    }
    const u = await loadProfile(sess.user.id);
    if (u) setUser(u);
  }, [loadProfile]);

  const hasRole = useCallback(
    (...roles: Role[]) => !!user && roles.includes(user.role),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      acknowledge,
      hasRole,
      allUsers,
      refreshProfile,
      refreshAllUsers,
    }),
    [user, loading, login, logout, acknowledge, hasRole, allUsers, refreshProfile, refreshAllUsers],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
