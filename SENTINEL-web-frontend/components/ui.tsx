import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Configuration } from "@sentinel/core";

export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={"btn " + className} {...props}>
      {children}
    </button>
  );
}
export function Tag({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={"tag " + tone}>
      <span className="dot" />
      {children}
    </span>
  );
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
    <section className={"panel " + className}>
      <header className="panel-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
      {footer && <footer className="panel-footer">{footer}</footer>}
    </section>
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
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="row">
        {children || <span className="date-label">Sep 1–10, 2026</span>}
      </div>
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
    <div className="segmented" role="group" aria-label="Configuration">
      {options.map(([configuration, label, description]) => (
        <button
          key={configuration}
          aria-label={description}
          title={description}
          aria-pressed={value === configuration}
          className={value === configuration ? "active" : ""}
          onClick={() => onChange(configuration)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export const severityTone = (severity: string) =>
  ["CRITICAL", "HIGH"].includes(severity)
    ? "red"
    : severity === "MEDIUM"
      ? "amber"
      : "blue";
export function Empty({ title = "No matching findings" }: { title?: string }) {
  return (
    <div className="empty" role="status">
      <h3>{title}</h3>
      <p>Try another filter.</p>
    </div>
  );
}
