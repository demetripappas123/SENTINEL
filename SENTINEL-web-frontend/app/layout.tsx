import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import { InspectionDataProvider } from "../lib/inspection-data";
import { QueueProvider } from "../lib/queue-data";
import "./globals.css";
export const metadata: Metadata = {
  title: "SENTINEL | SPOT operations",
  description:
    "Mission reliability and inspection triage for the NextEra challenge.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <a href="#main" className="skip-link">
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
