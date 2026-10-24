import type { Metadata, Viewport } from "next";
// Fonts are bundled with the app (not fetched from Google) so the dashboard works with the internet down.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Sentinel · Network Mission Control",
  description: "Watches your network, diagnoses outages on-device, fixes them, and calls your provider when it's their fault.",
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
