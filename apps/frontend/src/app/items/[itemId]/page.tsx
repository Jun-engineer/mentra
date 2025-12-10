import type { Metadata } from "next";
import ItemPageClient from "./item-page-client";
import { PLACEHOLDER_ITEM_ID } from "./constants";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { itemId: string }[] {
  return [{ itemId: PLACEHOLDER_ITEM_ID }];
}

export function generateMetadata(): Metadata {
  return {
    title: "Training Item • Mentra"
  };
}

export default function ItemPage({ params }: { params: { itemId: string } }) {
  return <ItemPageClient itemId={params.itemId} />;
}
