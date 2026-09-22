import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "CrisisSync — AI Emergency Response Network",
  description:
    "AI-powered emergency preparedness & response platform. Voice SOS triage, peer-to-peer micro-rescue, fake-report detection, live command dashboard.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-512.png", apple: "/icons/icon-512.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CrisisSync",
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0a1128",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a1128] font-sans text-slate-200 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
