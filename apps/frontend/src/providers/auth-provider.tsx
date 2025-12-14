'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type AuthRole = "admin" | "staff";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
};

export type AuthAccount = AuthUser & { password: string };

type AuthCredentials = {
  email: string;
  password: string;
};

type AuthAccountInput = {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
};

type AuthAccountUpdate = Partial<Omit<AuthAccount, "id">>;

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  accounts: AuthAccount[];
  login: (credentials: AuthCredentials) => Promise<AuthUser>;
  logout: () => void;
  createUser: (input: AuthAccountInput) => Promise<AuthAccount>;
  updateUser: (userId: string, updates: AuthAccountUpdate) => Promise<AuthAccount>;
  deleteUser: (userId: string) => Promise<void>;
};

const DEFAULT_ACCOUNTS: AuthAccount[] = [
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

const USER_STORAGE_KEY = "mentra:auth:user";
const ACCOUNTS_STORAGE_KEY = "mentra:auth:accounts";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normaliseEmail = (email: string) => email.trim().toLowerCase();

const generateAccountId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

const sanitiseAccounts = (value: unknown): AuthAccount[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_ACCOUNTS;
  }

  const result: AuthAccount[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const { id, name, email, role, password } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !id.trim()) {
      continue;
    }
    if (typeof name !== "string" || !name.trim()) {
      continue;
    }
    if (typeof email !== "string" || !email.trim()) {
      continue;
    }
    if (role !== "admin" && role !== "staff") {
      continue;
    }
    if (typeof password !== "string" || !password.length) {
      continue;
    }
    result.push({
      id: id.trim(),
      name: name.trim(),
      email: email.trim(),
      role,
      password
    });
  }
  return result.length ? result : DEFAULT_ACCOUNTS;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>(DEFAULT_ACCOUNTS);
  const accountsRef = useRef<AuthAccount[]>(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistAccounts = useCallback((nextAccounts: AuthAccount[]) => {
    accountsRef.current = nextAccounts;
    setAccounts(nextAccounts);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(nextAccounts));
      } catch (storageError) {
        console.warn("Failed to persist accounts", storageError);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    try {
      const storedAccountsRaw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (storedAccountsRaw) {
        const parsed = JSON.parse(storedAccountsRaw) as unknown;
        const sanitised = sanitiseAccounts(parsed);
        accountsRef.current = sanitised;
        setAccounts(sanitised);
        window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(sanitised));
      } else {
        window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
      }

      const storedUserRaw = window.localStorage.getItem(USER_STORAGE_KEY);
      if (storedUserRaw) {
        const parsedUser = JSON.parse(storedUserRaw) as Partial<AuthUser>;
        if (parsedUser && typeof parsedUser.id === "string" && typeof parsedUser.name === "string" && typeof parsedUser.email === "string" && (parsedUser.role === "admin" || parsedUser.role === "staff")) {
          setUser({
            id: parsedUser.id,
            name: parsedUser.name,
            email: parsedUser.email,
            role: parsedUser.role
          });
        }
      }
    } catch (storageError) {
      console.warn("Failed to initialise auth state", storageError);
      accountsRef.current = DEFAULT_ACCOUNTS;
      setAccounts(DEFAULT_ACCOUNTS);
      window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials: AuthCredentials): Promise<AuthUser> => {
    setError(null);
    const email = normaliseEmail(credentials.email);
    const account = accountsRef.current.find(entry => normaliseEmail(entry.email) === email);

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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    }
    return authUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  const createUser = useCallback(async (input: AuthAccountInput): Promise<AuthAccount> => {
    const name = input.name.trim();
    const email = input.email.trim();
    const password = input.password;

    if (!name.length) {
      throw new Error("Name is required");
    }
    if (!email.length) {
      throw new Error("Email is required");
    }
    if (!password.length) {
      throw new Error("Password is required");
    }

    const normalisedEmail = normaliseEmail(email);
    if (accountsRef.current.some(account => normaliseEmail(account.email) === normalisedEmail)) {
      throw new Error("Email is already in use");
    }

    if (input.role !== "admin" && input.role !== "staff") {
      throw new Error("Invalid role");
    }

    const newAccount: AuthAccount = {
      id: generateAccountId(),
      name,
      email,
      role: input.role,
      password
    };

    persistAccounts([...accountsRef.current, newAccount]);
    return newAccount;
  }, [persistAccounts]);

  const updateUser = useCallback(async (userId: string, updates: AuthAccountUpdate): Promise<AuthAccount> => {
    const existingIndex = accountsRef.current.findIndex(account => account.id === userId);
    if (existingIndex < 0) {
      throw new Error("User not found");
    }

    const existing = accountsRef.current[existingIndex];

    const name = typeof updates.name === "string" ? updates.name.trim() : existing.name;
    const email = typeof updates.email === "string" ? updates.email.trim() : existing.email;
    const role = updates.role ?? existing.role;
    const password = updates.password !== undefined ? updates.password : existing.password;

    if (!name.length) {
      throw new Error("Name is required");
    }
    if (!email.length) {
      throw new Error("Email is required");
    }
    if (!password.length) {
      throw new Error("Password is required");
    }

    const normalisedEmail = normaliseEmail(email);
    if (accountsRef.current.some((account, index) => index !== existingIndex && normaliseEmail(account.email) === normalisedEmail)) {
      throw new Error("Email is already in use");
    }

    if (role !== "admin" && role !== "staff") {
      throw new Error("Invalid role");
    }

    const updatedAccount: AuthAccount = {
      id: existing.id,
      name,
      email,
      role,
      password
    };

    const nextAccounts = [...accountsRef.current];
    nextAccounts[existingIndex] = updatedAccount;
    persistAccounts(nextAccounts);

    if (user?.id === updatedAccount.id) {
      const nextUser: AuthUser = {
        id: updatedAccount.id,
        name: updatedAccount.name,
        email: updatedAccount.email,
        role: updatedAccount.role
      };
      setUser(nextUser);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
      }
    }

    return updatedAccount;
  }, [persistAccounts, user]);

  const deleteUser = useCallback(async (userId: string): Promise<void> => {
    const accountsSnapshot = accountsRef.current;
    const target = accountsSnapshot.find(account => account.id === userId);
    if (!target) {
      throw new Error("User not found");
    }

    if (target.role === "admin") {
      const adminCount = accountsSnapshot.filter(account => account.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error("At least one admin account is required");
      }
    }

    const nextAccounts = accountsSnapshot.filter(account => account.id !== userId);
    persistAccounts(nextAccounts);

    if (user?.id === userId) {
      logout();
    }
  }, [persistAccounts, logout, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      accounts,
      login,
      logout,
      createUser,
      updateUser,
      deleteUser
    }),
    [user, loading, error, accounts, login, logout, createUser, updateUser, deleteUser]
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
