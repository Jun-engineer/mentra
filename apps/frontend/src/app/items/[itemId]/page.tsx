import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchMenuItem, fetchMenuItems } from "@/lib/menu-service";
import type { MenuItem } from "@/data/menu";
import { slugify } from "@/data/menu";

export const dynamic = "force-static";

export async function generateStaticParams(): Promise<Array<{ itemId: string }>> {
  try {
    const items = await fetchMenuItems({ cache: "force-cache" });
    return items.map(item => ({ itemId: item.id }));
  } catch (error) {
    console.warn("Mentra export: failed to load menu items for static params", error);
    return [];
  }
}

export async function generateMetadata({
  params
}: {
  params: { itemId: string };
}): Promise<Metadata> {
  try {
    const item = await fetchMenuItem(params.itemId, { cache: "force-cache" });

    if (!item) {
      return {
        title: "Training Item • Mentra"
      };
    }

    return {
      title: `${item.title} • Mentra`,
      description: item.description ?? undefined
    };
  } catch (error) {
    console.warn("Mentra export: failed to load metadata for item", params.itemId, error);
    return {
      title: "Training Item • Mentra"
    };
  }
}

export default async function ItemPage({ params }: { params: { itemId: string } }) {
  let item: MenuItem | null = null;
  try {
    item = await fetchMenuItem(params.itemId, { cache: "force-cache" });
  } catch (error) {
    console.warn("Mentra export: failed to load item", params.itemId, error);
  }

  if (!item) {
    notFound();
  }

  const categorySlug = slugify(item.category);

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="space-y-2">
          <nav className="text-xs uppercase tracking-[0.3em] text-amber-500">
            <Link href="/" className="hover:underline">
              Mentra
            </Link>
            <span className="px-2 text-neutral-400">/</span>
            <Link href={`/#${categorySlug}`} className="hover:underline">
              {item.category}
            </Link>
            <span className="px-2 text-neutral-400">/</span>
            <span className="text-neutral-500">{item.subcategory}</span>
          </nav>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">
              Training Card
            </p>
            <h1 className="text-4xl font-bold text-neutral-900 sm:text-5xl">{item.title}</h1>
            <p className="mt-3 text-base text-neutral-700">{item.description ?? "Details coming soon."}</p>
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-amber-100 bg-neutral-100 shadow-sm">
          {item.videoUrl ? (
            <iframe
              src={item.videoUrl}
              title={item.title}
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

        <section className="space-y-3 rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Quick Steps</h2>
          {item.steps.length ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700">
              {item.steps.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-neutral-600">Steps will be added soon.</p>
          )}
        </section>

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
