import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JalSuraksha Nepal — Know the Risk. Find Safety. Get Help.",
    template: "%s · JalSuraksha Nepal",
  },
  description:
    "Flood emergency response and evacuation platform for Nepal: live risk, safe routes, shelters, SOS and coordinated rescue.",
  applicationName: "JalSuraksha Nepal",
  appleWebApp: { capable: true, title: "JalSuraksha", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f2447",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {!isSupabaseConfigured() && (
          <div role="alert" className="bg-high-strong px-4 py-2 text-center text-sm font-medium text-white">
            Setup required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Live data,
            SOS and sign-in are unavailable. See README → Environment variables.
          </div>
        )}
        {children}
        <Toaster position="top-center" />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
