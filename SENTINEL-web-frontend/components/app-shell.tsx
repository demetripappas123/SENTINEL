"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  Activity,
  History,
  LayoutDashboard,
  Map,
  Moon,
  Route,
  Shield,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { dataset, getFindings } from "@sentinel/core";
import { useReviews, useTheme } from "../lib/browser-state";
import { Button } from "./ui";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/missions", label: "Missions", icon: Route },
  { href: "/review", label: "Review", icon: TriangleAlert },
  { href: "/facility", label: "Facility", icon: Map },
  { href: "/replay", label: "Replay", icon: History },
];
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { reviewedIds } = useReviews();
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const counts: Record<string, number | undefined> = {
    "/missions": dataset.missions.length,
    "/review": getFindings(dataset, { reviewedIds }).length,
    "/facility": dataset.locations.length,
    "/replay": dataset.events.length,
  };
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <Shield className="icon" />
          SENTINEL
        </Link>
        <div className="top-divider" />
        <span className="breadcrumb">NextEra / SPOT</span>
        <span className="spacer" />
        <Button
          className="quiet square"
          onClick={toggleTheme}
          aria-label={
            "Switch to " + (theme === "light" ? "dark" : "light") + " theme"
          }
        >
          {theme === "light" ? (
            <Moon className="icon" />
          ) : (
            <Sun className="icon" />
          )}
        </Button>
        <span className="avatar">OP</span>
      </header>
      <aside className="sidebar">
        <div className="workspace">
          <span className="workspace-mark">
            <Activity className="icon" />
          </span>
          <div>
            <strong>SPOT operations</strong>
            <small className="muted">NextEra challenge</small>
          </div>
        </div>
        <nav className="nav-group" aria-label="Workspace">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={"nav-item " + (active ? "active" : "")}
                aria-current={active ? "page" : undefined}
                title={label}
              >
                <Icon className="icon" />
                <span className="label">{label}</span>
                <span className="nav-count">{counts[href]}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <p className="mono">27 missions · 270 actions</p>
          <p>Sep 1–10, 2026</p>
        </div>
      </aside>
      <main id="main" className="main">
        {children}
      </main>
    </div>
  );
}
