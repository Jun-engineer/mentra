import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerClient from "../components/service-worker-client";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mentra",
  description: "Multi-tenant training operations platform for restaurants",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/mentra-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/mentra-icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/mentra-icon-64.png", sizes: "64x64", type: "image/png" }
    ],
    shortcut: ["/icons/mentra-icon-32.png"],
    apple: ["/apple-touch-icon.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#fef3c7",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-white">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-neutral-900`}>
        <ServiceWorkerClient />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
