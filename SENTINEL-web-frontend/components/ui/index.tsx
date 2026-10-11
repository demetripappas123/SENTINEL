"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Configuration } from "@sentinel/core";
import { Badge } from "@/components/ui/badge";
import { Button as ShadButton } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const names = className.split(/\s+/);
  const variant =
    names.includes("green") || names.includes("blue")
      ? "default"
      : names.includes("quiet")
        ? "ghost"
        : "outline";
  const size = names.includes("square") ? "icon" : "sm";
  return (
    <ShadButton type="button" variant={variant} size={size} {...props}>
      {children}
    </ShadButton>
  );
}

const badgeTone = {
  green: "success",
  red: "destructive",
  amber: "secondary",
  yellow: "secondary",
  blue: "outline",
  navy: "outline",
} as const;

export function Tag({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  const variant = badgeTone[tone as keyof typeof badgeTone] ?? "default";
  return <Badge variant={variant}>{children}</Badge>;
}

export function Panel({
  title,
  action,
  children,
  footer,
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">{title}</CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      {children}
      {footer && <CardFooter className="panel-footer">{footer}</CardFooter>}
    </Card>
  );
}

export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function ConfigurationControl({
  value,
  onChange,
}: {
  value: Configuration;
  onChange: (value: Configuration) => void;
}) {
  const options: [Configuration, string, string][] = [
    ["ALL", "All runs", "All configurations"],
    ["BASELINE", "V1", "Baseline configuration"],
    ["IMPROVED", "V2", "Improved configuration"],
  ];
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as Configuration);
      }}
      aria-label="Configuration"
    >
      {options.map(([configuration, label, description]) => (
        <ToggleGroupItem
          key={configuration}
          value={configuration}
          aria-label={description}
          title={description}
        >
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export const severityTone = (severity: string) =>
  ["CRITICAL", "HIGH"].includes(severity)
    ? "red"
    : severity === "MEDIUM"
      ? "amber"
      : "blue";

export function LoadingStatus({
  label = "Loading inspections…",
}: {
  label?: string;
}) {
  return (
    <p className="panel-body" role="status">
      {label}
    </p>
  );
}

export function Empty({ title = "No matching findings" }: { title?: string }) {
  return (
    <div
      className="flex flex-col gap-1 py-8 text-muted-foreground"
      role="status"
    >
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="text-sm">Try another filter.</p>
    </div>
  );
}
