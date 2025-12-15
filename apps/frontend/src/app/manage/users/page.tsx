'use client';

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth, type AuthAccount, type AuthRole } from "@/providers/auth-provider";

const buildEmptyForm = (): UserFormValues => ({
  name: "",
  email: "",
  password: "",
  role: "staff"
});

type UserFormValues = {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
};

type TabKey = "register" | "modify" | "delete";

const tabs: { key: TabKey; label: string; description: string }[] = [
  { key: "register", label: "Register", description: "Create a new team member account." },
  { key: "modify", label: "Modify", description: "Update an existing account's details." },
  { key: "delete", label: "Delete", description: "Remove access for a team member." }
];

export default function UserManagementPage() {
  const { user, loading, accounts, createUser, updateUser, deleteUser, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("register");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [registerForm, setRegisterForm] = useState<UserFormValues>(buildEmptyForm);
  const [registerSaving, setRegisterSaving] = useState(false);
  const [modifySelection, setModifySelection] = useState<string | null>(null);
  const [modifyForm, setModifyForm] = useState<UserFormValues>(buildEmptyForm);
  const [modifySaving, setModifySaving] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) {
      setMenuOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    setFeedback(null);
  }, [activeTab]);

  useEffect(() => {
    if (!accounts.length) {
      setModifySelection(null);
      setModifyForm(buildEmptyForm());
      return;
    }
    const selected = accounts.find(account => account.id === modifySelection) ?? accounts[0];
    setModifySelection(selected.id);
    setModifyForm({
      name: selected.name,
      email: selected.email,
      password: selected.password,
      role: selected.role
    });
  }, [accounts, modifySelection]);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [feedback]);

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterSaving(true);
    try {
      const created = await createUser(registerForm);
      setFeedback({ type: "success", message: `Registered ${created.name}.` });
      setRegisterForm(buildEmptyForm());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to register user.";
      setFeedback({ type: "error", message });
    } finally {
      setRegisterSaving(false);
    }
  };

  const handleModifySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modifySelection) {
      setFeedback({ type: "error", message: "Select a user to modify." });
      return;
    }
    setModifySaving(true);
    try {
      await updateUser(modifySelection, modifyForm);
      setFeedback({ type: "success", message: `Updated ${modifyForm.name}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update user.";
      setFeedback({ type: "error", message });
    } finally {
      setModifySaving(false);
    }
  };

  const handleDelete = async (account: AuthAccount) => {
    if (deleteInFlight) {
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete “${account.name}”?`);
      if (!confirmed) {
        return;
      }
    }
    setDeleteInFlight(account.id);
    try {
      await deleteUser(account.id);
      setFeedback({ type: "success", message: `Deleted ${account.name}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete user.";
      setFeedback({ type: "error", message });
    } finally {
      setDeleteInFlight(null);
    }
  };

  const modifyTabDisabled = !accounts.length;
  const deleteTabDisabled = !accounts.length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
        Loading access…
      </div>
    );
  }

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
        Redirecting…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/icons/mentra-icon-64.png" alt="Mentra" width={40} height={40} className="h-10 w-10" priority />
              <span className="text-2xl font-semibold text-neutral-900">Mentra Manual</span>
            </Link>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label={menuOpen ? "Hide menu" : "Show menu"}
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <MenuIcon className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 text-center text-neutral-700 sm:px-6">
          <h1 className="text-3xl font-semibold text-neutral-900">Administrator access required</h1>
          <p className="text-sm">You need admin privileges to manage user accounts.</p>
          <Link href="/" className="inline-flex justify-center rounded-full border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50">
            ← Back to training library
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/icons/mentra-icon-64.png" alt="Mentra" width={40} height={40} className="h-10 w-10" priority />
            <span className="text-2xl font-semibold text-neutral-900">Mentra Manual</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-neutral-600">
            <span className="hidden sm:inline text-neutral-500">{user.name}</span>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label={menuOpen ? "Hide menu" : "Show menu"}
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <MenuIcon className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl">
                  <Link
                    href="/manage/training"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Training Management
                  </Link>
                  <Link
                    href="/manage/menus"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Menu Management
                  </Link>
                  <Link
                    href="/manage/users"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    User Management
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-3">
          <Link href="/" className="text-sm font-medium text-blue-600 transition hover:text-blue-700">
            ← Back to training library
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">User Management</h1>
          <p className="text-sm text-neutral-600">Register new employees, update their details, or remove access when someone leaves.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            const isDisabled = (tab.key === "modify" && modifyTabDisabled) || (tab.key === "delete" && deleteTabDisabled);
            return (
              <button
                key={tab.key}
                type="button"
                disabled={isDisabled}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${isActive ? "border-blue-500 bg-blue-500 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"} ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">{tabs.find(tab => tab.key === activeTab)?.description}</p>

        {feedback ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            {feedback.message}
          </div>
        ) : null}

        {activeTab === "register" ? (
          <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Register new user</h2>
            <form className="mt-4 space-y-4" onSubmit={handleRegisterSubmit}>
              <label className="block text-sm font-medium text-neutral-700">
                Name
                <input
                  type="text"
                  value={registerForm.name}
                  onChange={event => setRegisterForm(prev => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={event => setRegisterForm(prev => ({ ...prev, email: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Password
                <input
                  type="text"
                  value={registerForm.password}
                  onChange={event => setRegisterForm(prev => ({ ...prev, password: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Role
                <select
                  value={registerForm.role}
                  onChange={event => setRegisterForm(prev => ({ ...prev, role: event.target.value as AuthRole }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRegisterForm(buildEmptyForm())}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
                  disabled={registerSaving}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={registerSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {registerSaving ? "Registering…" : "Register user"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === "modify" ? (
          <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Modify user</h2>
            {modifyTabDisabled ? (
              <p className="mt-2 text-sm text-neutral-600">No users available. Register a user first.</p>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={handleModifySubmit}>
                <label className="block text-sm font-medium text-neutral-700">
                  Select user
                  <select
                    value={modifySelection ?? ""}
                    onChange={event => setModifySelection(event.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Name
                  <input
                    type="text"
                    value={modifyForm.name}
                    onChange={event => setModifyForm(prev => ({ ...prev, name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Email
                  <input
                    type="email"
                    value={modifyForm.email}
                    onChange={event => setModifyForm(prev => ({ ...prev, email: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Password
                  <input
                    type="text"
                    value={modifyForm.password}
                    onChange={event => setModifyForm(prev => ({ ...prev, password: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Role
                  <select
                    value={modifyForm.role}
                    onChange={event => setModifyForm(prev => ({ ...prev, role: event.target.value as AuthRole }))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={modifySaving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {modifySaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </section>
        ) : null}

        {activeTab === "delete" ? (
          <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Delete user</h2>
            {deleteTabDisabled ? (
              <p className="mt-2 text-sm text-neutral-600">No users available. Register a user first.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {accounts.map(account => (
                  <div key={account.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{account.name}</p>
                      <p className="text-xs text-neutral-500">{account.email}</p>
                      <p className="text-xs text-neutral-500">Role: {account.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(account)}
                      disabled={deleteInFlight === account.id}
                      className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deleteInFlight === account.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}

const MenuIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
    <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
  </svg>
);
