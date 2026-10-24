import type { Metadata, Viewport } from "next";
// Fonts are bundled with the app (not fetched from Google) so the dashboard works with the internet down.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "UPLink · Your network's advocate",
  description:
    "An AI agent for your office network: diagnoses outages on-device, fixes what it can, calls your provider with proof when it can't, and hands new faults to Devin.",
};

export const viewport: Viewport = {
  themeColor: "#04060a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
