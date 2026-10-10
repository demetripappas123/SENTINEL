import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import { InspectionDataProvider } from "../lib/inspection-data";
import { QueueProvider } from "../lib/queue-data";
import "./globals.css";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

const geist = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SENTINEL | SPOT Operations",
  description:
    "Mission reliability and inspection triage for NextEra Energy.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={cn("font-sans", geist.variable)}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <InspectionDataProvider>
          <QueueProvider>
            <AppShell>{children}</AppShell>
          </QueueProvider>
        </InspectionDataProvider>
      </body>
    </html>
  );
}
