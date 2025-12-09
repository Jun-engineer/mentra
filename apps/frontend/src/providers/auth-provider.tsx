'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthRole = "admin" | "staff";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
};

type AuthCredentials = {
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (credentials: AuthCredentials) => Promise<AuthUser>;
  logout: () => void;
};

export type DemoAccount = AuthUser & { password: string };

const TEST_ACCOUNTS: DemoAccount[] = [
  {
    id: "demo-admin",
    name: "Demo Admin",
    email: "admin@mentra.dev",
    role: "admin",
    password: "admin123"
  },
  {
    id: "demo-staff",
    name: "Demo Staff",
    email: "staff@mentra.dev",
    role: "staff",
    password: "staff123"
  }
];

const STORAGE_KEY = "mentra:auth:user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(parsed);
      }
    } catch (storageError) {
      console.warn("Failed to read stored auth state", storageError);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials: AuthCredentials): Promise<AuthUser> => {
    setError(null);
    const email = normaliseEmail(credentials.email);
    const account = TEST_ACCOUNTS.find(entry => normaliseEmail(entry.email) === email);

    if (!account || account.password !== credentials.password) {
      const message = "Invalid email or password";
      setError(message);
      throw new Error(message);
    }

    const authUser: AuthUser = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role
    };

    setUser(authUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      login,
      logout
    }),
    [user, loading, error, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export const testAccounts: DemoAccount[] = TEST_ACCOUNTS.map(account => ({ ...account }));
