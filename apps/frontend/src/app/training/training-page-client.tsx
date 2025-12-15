'use client';

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/data/menu";
import { fetchTrainingPlaylist } from "@/lib/menu-service";
import { PLACEHOLDER_ITEM_ID } from "@/app/items/[itemId]/constants";
import { appConfig } from "@/lib/config";
import { useAuth } from "@/providers/auth-provider";

type TrainingProgressEventDetail = {
  key: string;
};

const notifyTrainingProgressChange = (storageKey: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<TrainingProgressEventDetail>("mentra:training-progress-change", {
    detail: { key: storageKey }
  }));
};

type TrainingItemRowProps = {
  item: MenuItem;
  isCompleted: boolean;
  onToggleComplete: () => void;
};

const TrainingItemRow = ({ item, isCompleted, onToggleComplete }: TrainingItemRowProps) => (
  <li className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 transition ${isCompleted ? "opacity-60" : ""}`}>
    <input
      type="checkbox"
      checked={isCompleted}
      onChange={onToggleComplete}
      className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-400"
    />
    <Link
      href={`/items/${PLACEHOLDER_ITEM_ID}?id=${encodeURIComponent(item.id)}`}
      className={`flex-1 text-sm font-medium transition hover:underline ${isCompleted ? "line-through text-neutral-500" : "text-neutral-800"}`}
      prefetch={false}
    >
      {item.title}
    </Link>
  </li>
);

export default function TrainingPageClient() {
  const { user, loading, logout } = useAuth();
  const [trainingPlaylist, setTrainingPlaylist] = useState<MenuItem[]>([]);
  const [trainingCompletion, setTrainingCompletion] = useState<Record<string, boolean>>({});
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingPlaylistHydrated, setTrainingPlaylistHydrated] = useState(false);

  const isAdmin = user?.role === "admin";

  const trainingStorageKey = useMemo(() => {
    const tenant = appConfig.tenantId ?? "default";
    const userId = user?.id ?? "guest";
    return `mentra:training-progress:${tenant}:${userId}`;
  }, [user?.id]);

  const loadTrainingPlaylist = useCallback(async () => {
    if (!user) {
      return;
    }
    setTrainingLoading(true);
    try {
      const state = await fetchTrainingPlaylist();
      setTrainingPlaylist(state.items);
      setTrainingError(null);
      setTrainingPlaylistHydrated(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load training menu";
      setTrainingError(message);
    } finally {
      setTrainingLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      void loadTrainingPlaylist();
    }
    if (!user) {
      setTrainingPlaylist([]);
      setTrainingCompletion({});
      setTrainingError(null);
      setTrainingLoading(false);
      setTrainingPlaylistHydrated(false);
    }
  }, [loading, user, loadTrainingPlaylist]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(trainingStorageKey);
      if (!stored) {
        setTrainingCompletion({});
        return;
      }
      const parsed = JSON.parse(stored) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== "object") {
        setTrainingCompletion({});
        return;
      }
      const next: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "boolean") {
          next[key] = value;
        }
      }
      setTrainingCompletion(next);
    } catch (storageError) {
      console.warn("Failed to load training progress", storageError);
      setTrainingCompletion({});
    }
  }, [user, trainingStorageKey]);

  useEffect(() => {
    if (!trainingPlaylistHydrated) {
      return;
    }
    setTrainingCompletion(prev => {
      const validIds = new Set(trainingPlaylist.map(item => item.id));
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [id, value] of Object.entries(prev)) {
        if (validIds.has(id)) {
          next[id] = value;
        } else {
          changed = true;
        }
      }
      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(trainingStorageKey, JSON.stringify(next));
          notifyTrainingProgressChange(trainingStorageKey);
        } catch (storageError) {
          console.warn("Failed to persist training progress", storageError);
        }
      }
      return next;
    });
  }, [trainingPlaylistHydrated, trainingPlaylist, trainingStorageKey]);

  const trainingCompletedCount = useMemo(() => {
    return trainingPlaylist.reduce((count, item) => (trainingCompletion[item.id] ? count + 1 : count), 0);
  }, [trainingPlaylist, trainingCompletion]);

  const trainingProgressPercent = useMemo(() => {
    if (!trainingPlaylist.length) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round((trainingCompletedCount / trainingPlaylist.length) * 100)));
  }, [trainingCompletedCount, trainingPlaylist]);

  const handleTrainingToggleComplete = useCallback(
    (itemId: string) => {
      setTrainingCompletion(prev => {
        const next = { ...prev };
        if (next[itemId]) {
          delete next[itemId];
        } else {
          next[itemId] = true;
        }
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(trainingStorageKey, JSON.stringify(next));
            notifyTrainingProgressChange(trainingStorageKey);
          } catch (storageError) {
            console.warn("Failed to persist training progress", storageError);
          }
        }
        return next;
      });
    },
    [trainingStorageKey]
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/icons/mentra-icon-64.png" alt="Mentra" width={40} height={40} className="h-10 w-10" priority />
            <span className="text-2xl font-semibold text-neutral-900">Mentra Manual</span>
          </Link>
          {user ? (
            <div className="flex items-center gap-3 text-sm text-neutral-600">
              <span>{user.name}</span>
              <span className="hidden sm:inline text-neutral-300">•</span>
              <span className="hidden sm:inline capitalize text-neutral-500">{user.role}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-blue-300 px-4 py-1 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-neutral-500">Checking access…</div>
        ) : null}

        {!loading && !user ? (
          <section className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-blue-200/70 bg-blue-50/60 p-8 text-center">
            <h1 className="text-3xl font-semibold text-neutral-900">Welcome to Mentra</h1>
            <p className="text-sm text-neutral-600">Sign in with one of the demo accounts to browse the training menu.</p>
            <Link
              href="/login"
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Go to login
            </Link>
          </section>
        ) : null}

        {!loading && user ? (
          <>
            <section className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-neutral-900">Training Menu</h1>
                  <p className="text-sm text-neutral-600">Work through each module and mark it complete when you finish.</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <Link href="/" className="text-sm font-medium text-blue-600 transition hover:text-blue-700">
                    ← Back to training library
                  </Link>
                </div>
              </div>

              {trainingError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{trainingError}</p>
              ) : null}

              {trainingLoading ? (
                <div className="flex h-20 items-center justify-center text-sm text-neutral-600">Loading training menu…</div>
              ) : null}

              {!trainingLoading && trainingPlaylist.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <div className="flex items-center justify-between text-xs font-medium text-neutral-600">
                      <span>{trainingCompletedCount} of {trainingPlaylist.length} completed</span>
                      <span>{trainingProgressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${trainingProgressPercent}%` }} />
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {trainingPlaylist.map(item => (
                      <TrainingItemRow
                        key={item.id}
                        item={item}
                        isCompleted={Boolean(trainingCompletion[item.id])}
                        onToggleComplete={() => handleTrainingToggleComplete(item.id)}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              {!trainingLoading && trainingPlaylist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-6 text-sm text-neutral-700">
                  {isAdmin
                    ? "No training items yet. Add modules from Training Management."
                    : "Your training menu is empty right now. Check back soon."}
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
