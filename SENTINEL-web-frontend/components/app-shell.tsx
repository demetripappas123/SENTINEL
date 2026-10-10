"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  Boxes,
  History,
  LayoutDashboard,
  Map,
  Moon,
  Route,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { selectQueue } from "@sentinel/core";
import { useReviews, useTheme } from "../lib/browser-state";
import {
  pendingCount,
  useInspectionData,
  useInspectionDetailReady,
  useInspectionReady,
} from "../lib/inspection-data";
import { useQueue, useQueueReady } from "../lib/queue-data";
import { cn } from "@/lib/utils";
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
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/review", label: "Review", icon: TriangleAlert },
  { href: "/facility", label: "Facility", icon: Map },
  { href: "/replay", label: "Replay", icon: History },
];
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const data = useInspectionData();
  const dataReady = useInspectionReady();
  const detailReady = useInspectionDetailReady();
  const queue = useQueue();
  const queueReady = useQueueReady();
  const { reviewedIds } = useReviews();
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const counts: Record<string, number | string | undefined> = {
    "/missions": dataReady ? data.missions.length : pendingCount,
    "/assets": dataReady ? data.assets.length : pendingCount,
    "/review": dataReady && queueReady ? selectQueue(queue, { reviewedIds }).length : pendingCount,
    "/facility": dataReady ? data.locations.length : pendingCount,
    "/replay": detailReady ? data.events.length : pendingCount,
  };
  return (
    <div className="grid h-dvh grid-cols-[212px_minmax(0,1fr)] grid-rows-[52px_minmax(0,1fr)] bg-background text-foreground">
      <header className="col-span-2 flex items-center gap-4 border-b px-5">
        <Link className="flex items-center gap-2 text-base font-semibold tracking-wide" href="/">
          <Image
            src="/logo.png"
            alt=""
            width={22}
            height={24}
            className="dark:invert"
          />
          SENTINEL
        </Link>
        <span className="h-5 border-l" />
        <span className="text-xs text-muted-foreground">NextEra / SPOT</span>
        <span className="flex-1" />
        <Tag>Synthetic data</Tag>
        <Button
          className="quiet square"
          onClick={toggleTheme}
          aria-label={
            "Switch to " + (theme === "light" ? "dark" : "light") + " theme"
          }
        >
          {theme === "light" ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
        </Button>
        <span className="grid size-7 place-items-center rounded-full border text-[10px]">
          OP
        </span>
      </header>
      <aside className="flex flex-col border-r bg-sidebar p-3 text-sidebar-foreground">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <Image
            src="/logo.png"
            alt=""
            width={20}
            height={22}
            className="dark:invert"
          />
          <div>
            <strong className="block text-xs">SPOT Operations</strong>
            <small className="text-[10px] text-muted-foreground">
              NextEra Energy
            </small>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Workspace">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted-foreground",
                  active && "nav-current",
                )}
                aria-current={active ? "page" : undefined}
                title={label}
              >
                <Icon className="size-4" />
                <span>{label}</span>
                <span className="ml-auto font-mono text-[10px]">
                  {counts[href]}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t px-2 pt-3 text-[11px] text-muted-foreground">
          <p className="font-mono">
            {dataReady ? data.missions.length : pendingCount} missions ·{" "}
            {dataReady ? data.actions.length : pendingCount} actions
          </p>
          <p className="mt-1.5">{dataReady ? storedRange(data.missions) : pendingCount}</p>
        </div>
      </aside>
      <main id="main" className="overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
