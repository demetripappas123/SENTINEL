"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Building2,
  History,
  LayoutDashboard,
  Map,
  Moon,
  Plug,
  Route,
  Sun,
  TriangleAlert,
  User,
  Webhook,
} from "lucide-react";
import { selectQueue } from "@sentinel/core";
import { useReviews, useTheme } from "../lib/browser-state";
import { useInspectionData, useInspectionState } from "../lib/inspection-data";
import { useQueue, useQueueState } from "../lib/queue-data";
import { DataBoundary } from "./data-boundary";
import { AssistantButton } from "./assistant-button";
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
  { href: "/review", label: "Review", icon: TriangleAlert },
  { href: "/facility", label: "Facility", icon: Map },
  { href: "/replay", label: "Replay", icon: History },
  { href: "/orbit", label: "Orbit", icon: Webhook, metric: false, trailing: Plug },
  { href: "/settings/user", label: "User", icon: User, metric: false },
  { href: "/settings/organization", label: "Organization", icon: Building2, metric: false },
];
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const signedOut = path === "/login";
  const data = useInspectionData();
  const queue = useQueue();
  const inspectionState = useInspectionState();
  const queueState = useQueueState();
  const requests =
    path.startsWith("/orbit") || path.startsWith("/settings")
      ? []
      : path === "/" ||
          path.startsWith("/review") ||
          path.startsWith("/missions")
        ? [inspectionState, queueState]
        : [inspectionState];
  const { reviewedIds } = useReviews();
  const { theme, toggleTheme } = useTheme();
  const signOutDialog = useRef<HTMLDialogElement>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [userName, setUserName] = useState("");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  useEffect(() => {
    if (signedOut) return;
    let active = true;
    void fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!active || !body) return;
        if (typeof body.organization?.name === "string") setOrganizationName(body.organization.name);
        if (typeof body.user?.name === "string") setUserName(body.user.name);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [signedOut]);
  if (signedOut) return children;
  const counts: Record<string, number | undefined> = {
    "/missions": data.missions.length,
    "/review": selectQueue(queue, { reviewedIds }).length,
    "/facility": data.locations.length,
    "/replay": data.events.length,
  };
  return (
    <div className="app-frame grid h-dvh grid-cols-[212px_minmax(0,1fr)] grid-rows-[52px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
      <header className="col-span-2 flex items-center gap-4 border-b px-5">
        <Link className="flex items-center gap-2" href="/">
          <Image
            src="/logo.png"
            alt=""
            width={22}
            height={24}
            className="dark:invert"
          />
          <span className="flex flex-col">
            <span className="text-base font-semibold leading-none tracking-wide">
              SENTINEL
            </span>
            <span className="mt-1 text-[10px] font-normal leading-none text-muted-foreground">
              Version 0.1 Alpha
            </span>
          </span>
        </Link>
        <span className="flex-1" />
        <Tag>Synthetic data</Tag>
        <AssistantButton />
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
        <Button
          className="quiet"
          onClick={() => signOutDialog.current?.showModal()}
        >
          Sign out
        </Button>
        <Link
          href="/settings/user"
          aria-label="User settings"
          className="grid size-7 place-items-center rounded-full border text-[10px]"
        >
          OP
        </Link>
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
          <div className="leading-none">
            <strong className="block text-xs leading-none">{organizationName || "Organization"}</strong>
            <small className="mt-0.5 block text-[10px] leading-none text-muted-foreground">
              {userName}
            </small>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Workspace">
          {navigation.map((item) => {
            const { href, label, icon: Icon } = item;
            const Trailing = "trailing" in item ? item.trailing : undefined;
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
                {Trailing ? (
                  <Trailing className="nav-trailing ml-auto size-3.5" aria-hidden />
                ) : "metric" in item && item.metric === false ? null : (
                  <span className="ml-auto font-mono text-[10px]">
                    {(href === "/review"
                      ? queueState.status
                      : inspectionState.status) === "ready"
                      ? counts[href]
                      : "—"}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t px-2 pt-3 text-[11px] text-muted-foreground">
          <p className="font-mono">
            {inspectionState.status === "ready"
              ? `${data.missions.length} missions · ${data.actions.length} actions`
              : inspectionState.status === "error"
                ? "Data unavailable"
                : "Fetching records…"}
          </p>
          <p className="mt-1.5">
            {inspectionState.status === "ready"
              ? storedRange(data.missions)
              : ""}
          </p>
        </div>
      </aside>
      <main id="main" className="relative min-h-0 overflow-auto p-6">
        <DataBoundary requests={requests}>{children}</DataBoundary>
      </main>
      <dialog
        ref={signOutDialog}
        aria-labelledby="sign-out-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) signOutDialog.current?.close();
        }}
      >
        <header className="dialog-head">
          <h2 id="sign-out-title">Sign out</h2>
        </header>
        <div className="dialog-content">
          <p>Are you sure?</p>
        </div>
        <footer className="dialog-foot">
          <Button onClick={() => signOutDialog.current?.close()}>Cancel</Button>
          <Button
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/login";
              });
            }}
          >
            Sign out
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
