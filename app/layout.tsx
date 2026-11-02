import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { brand } from "@/config/brand";
import "./globals.css";

const manrope = localFont({
  src: "./fonts/Manrope-Variable-latin.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter-Variable-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: `${brand.name} · ${brand.category}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} · Find local prospects. Give them a reason to reply.`,
    description: brand.description,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0B1218",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
