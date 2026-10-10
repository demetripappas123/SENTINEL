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
import { selectQueue } from "@sentinel/core";
import { useReviews, useTheme } from "../lib/browser-state";
import { useInspectionData } from "../lib/inspection-data";
import { useQueue } from "../lib/queue-data";
import { Button, Tag } from "./ui";

function storedRange(missions: { start_time: string | null }[]) {
  const days = missions
    .map((mission) => mission.start_time?.slice(0, 10) ?? "")
    .filter((day) => day.length === 10)
    .sort();
  if (!days.length) return "No stored runs";
  return days[0] === days[days.length - 1]
    ? days[0]
    : days[0] + " – " + days[days.length - 1];
}

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/missions", label: "Missions", icon: Route },
  { href: "/review", label: "Review", icon: TriangleAlert },
  { href: "/facility", label: "Facility", icon: Map },
  { href: "/replay", label: "Replay", icon: History },
];
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const data = useInspectionData();
  const queue = useQueue();
  const { reviewedIds } = useReviews();
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const counts: Record<string, number | undefined> = {
    "/missions": data.missions.length,
    "/review": selectQueue(queue, { reviewedIds }).length,
    "/facility": data.locations.length,
    "/replay": data.events.length,
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
        <Tag>Synthetic data</Tag>
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
          <p className="mono">
            {data.missions.length} missions · {data.actions.length} actions
          </p>
          <p>{storedRange(data.missions)}</p>
        </div>
      </aside>
      <main id="main" className="main">
        {children}
      </main>
    </div>
  );
}
