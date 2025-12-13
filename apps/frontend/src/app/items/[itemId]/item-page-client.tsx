'use client';

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { MenuItem } from "@/data/menu";
import { slugify } from "@/data/menu";
import { fetchMenuItem } from "@/lib/menu-service";
import { PLACEHOLDER_ITEM_ID } from "./constants";

type FetchState = "idle" | "loading" | "loaded" | "not-found" | "error";

export default function ItemPageClient({ itemId }: { itemId: string }) {
  const searchParams = useSearchParams();
  const queryItemId = searchParams.get("id") ?? "";
  const resolvedItemId = itemId && itemId !== PLACEHOLDER_ITEM_ID
    ? itemId
    : queryItemId && queryItemId !== PLACEHOLDER_ITEM_ID
      ? queryItemId
      : "";

  const hasValidId = resolvedItemId.length > 0;
  const [item, setItem] = useState<MenuItem | null>(null);
  const [state, setState] = useState<FetchState>("idle");

  useEffect(() => {
    if (!hasValidId) {
      return;
    }

    const controller = new AbortController();

    async function loadItem() {
      startTransition(() => {
        setState("loading");
        setItem(null);
      });

      try {
        const fetchedItem = await fetchMenuItem(resolvedItemId, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!fetchedItem) {
          startTransition(() => {
            setState("not-found");
            setItem(null);
          });
          return;
        }

        startTransition(() => {
          setItem(fetchedItem);
          setState("loaded");
        });
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          return;
        }
        console.warn("Mentra client: failed to load menu item", resolvedItemId, error);
        startTransition(() => {
          setState("error");
          setItem(null);
        });
      }
    }

    loadItem();

    return () => {
      controller.abort();
    };
  }, [hasValidId, resolvedItemId]);

  const effectiveState: FetchState = !hasValidId ? "not-found" : state;
  const currentItem = hasValidId ? item : null;
  const categorySlug = currentItem?.category ? slugify(currentItem.category) : "";

  const renderBody = () => {
    if (effectiveState === "loading" || effectiveState === "idle") {
      return <p className="text-sm text-neutral-600">Loading item…</p>;
    }

    if (effectiveState === "not-found") {
      return <p className="text-sm text-neutral-600">This training item is not available yet.</p>;
    }

    if (effectiveState === "error") {
      return <p className="text-sm text-red-600">We couldn’t load this training card. Please try again later.</p>;
    }

    if (!currentItem) {
      return <p className="text-sm text-neutral-600">This training item is not available yet.</p>;
    }

    return (
      <>
        <header className="space-y-2">
          <nav className="text-xs uppercase tracking-[0.3em] text-blue-500">
            <Link href="/" className="hover:underline">
              Mentra
            </Link>
            <span className="px-2 text-neutral-400">/</span>
            <Link href={`/#${categorySlug}`} className="hover:underline">
              {currentItem.category}
            </Link>
            <span className="px-2 text-neutral-400">/</span>
            <span className="text-neutral-500">{currentItem.subcategory}</span>
          </nav>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-500">Training Card</p>
            <h1 className="text-4xl font-bold text-neutral-900 sm:text-5xl">{currentItem.title}</h1>
            <p className="mt-3 text-base text-neutral-700">{currentItem.description ?? "Details coming soon."}</p>
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-neutral-100 shadow-sm">
          {currentItem.videoUrl ? (
            <iframe
              src={currentItem.videoUrl}
              title={currentItem.title}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-white text-sm text-neutral-500">
              Video coming soon
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Quick Steps</h2>
          {currentItem.steps.length ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700">
              {currentItem.steps.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-neutral-600">Steps will be added soon.</p>
          )}
        </section>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
        {renderBody()}

        <footer>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            ← Back to manual
          </Link>
        </footer>
      </main>
    </div>
  );
}
