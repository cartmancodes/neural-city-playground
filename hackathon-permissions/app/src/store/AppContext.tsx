import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { RoleId, User } from "@/types";
import { DEMO_USERS } from "@/data/users";
import { ROLES } from "@/data/roles";
import { subscribe } from "@/services/api";

const STORAGE_KEY = "ap-gis.activeRole";

interface AppContextValue {
  activeRole: RoleId | null;
  activeUser: User | null;
  setActiveRole: (role: RoleId | null) => void;
  storeVersion: number; // bumps whenever the API store mutates
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeRole, setActiveRoleState] = useState<RoleId | null>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return (stored as RoleId | null) ?? null;
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => setVersion((v) => v + 1));
    return () => { unsub(); };
  }, []);

  const setActiveRole = useCallback((role: RoleId | null) => {
    setActiveRoleState(role);
    if (typeof window !== "undefined") {
      if (role) window.localStorage.setItem(STORAGE_KEY, role);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const activeUser = useMemo<User | null>(() => {
    if (!activeRole) return null;
    return DEMO_USERS.find((u) => u.role === activeRole) ?? {
      id: `U-${activeRole}`,
      name: ROLES[activeRole].label,
      role: activeRole,
    };
  }, [activeRole]);

  const value = useMemo<AppContextValue>(
    () => ({ activeRole, activeUser, setActiveRole, storeVersion: version }),
    [activeRole, activeUser, setActiveRole, version],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useActiveRole(): RoleId | null { return useApp().activeRole; }
