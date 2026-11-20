import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAZIX — Your Personal AI Workspace.",
  description: "A personal AI workspace with tools, memory, and multi-model support.",
  applicationName: "LAZIX",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#090d18",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}