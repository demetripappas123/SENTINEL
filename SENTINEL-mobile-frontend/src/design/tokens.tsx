import type { TextStyle } from "react-native";

export type Appearance = "light" | "dark";

// Mirrors the web dashboard's CSS variables (SENTINEL-web-frontend/app/globals.css),
// converted from oklch to sRGB hex so both clients render the same palette.
export type Theme = {
  mode: Appearance;
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  brand: string;
  brandForeground: string;
  chartAccent: string;
  good: string;
  mid: string;
  high: string;
  bad: string;
  destructive: string;
  overlay: string;
};

export const colors: Record<Appearance, Theme> = {
  light: {
    mode: "light",
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    primary: "#171717",
    primaryForeground: "#fafafa",
    secondary: "#f5f5f5",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    border: "#e5e5e5",
    input: "#e5e5e5",
    ring: "#a1a1a1",
    sidebar: "#fafafa",
    brand: "#2563eb",
    brandForeground: "#f3f9ff",
    chartAccent: "#2563eb",
    good: "#00801a",
    mid: "#ac7d00",
    high: "#d05500",
    bad: "#d01d21",
    destructive: "#e7000b",
    overlay: "#0a0a0a66",
  },
  dark: {
    mode: "dark",
    background: "#0a0a0a",
    foreground: "#fafafa",
    card: "#171717",
    primary: "#e5e5e5",
    primaryForeground: "#171717",
    secondary: "#262626",
    muted: "#262626",
    mutedForeground: "#a1a1a1",
    border: "#ffffff1a",
    input: "#ffffff26",
    ring: "#737373",
    sidebar: "#171717",
    brand: "#3478f6",
    brandForeground: "#f3f9ff",
    chartAccent: "#609aff",
    good: "#54bf5c",
    mid: "#e7bf4a",
    high: "#f98f3a",
    bad: "#f75d59",
    destructive: "#ff6467",
    overlay: "#000000a6",
  },
};

/** Applies an opacity to a 6-digit hex color, like `color-mix`/`bg-x/10` on web. */
export function alpha(hex: string, opacity: number) {
  return (
    hex.slice(0, 7) +
    Math.round(Math.min(1, Math.max(0, opacity)) * 255)
      .toString(16)
      .padStart(2, "0")
  );
}

export function severityColor(theme: Theme, severity: string) {
  return severity === "CRITICAL"
    ? theme.bad
    : severity === "HIGH"
      ? theme.high
      : severity === "MEDIUM"
        ? theme.mid
        : theme.chartAccent;
}

/** Web `--radius` is 10px; these follow its sm/md/lg/xl multipliers. */
export const radii = { sm: 6, md: 8, lg: 10, xl: 14, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 };
export const fonts = { mono: "Menlo" };
const tabular = ["tabular-nums"] as TextStyle["fontVariant"];
export const typography = {
  heading: { fontSize: 24, fontWeight: "600", letterSpacing: -0.6 },
  title: { fontSize: 15, fontWeight: "500" },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 17 },
  caption: { fontSize: 11, lineHeight: 15 },
  overline: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  metric: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -1,
    fontVariant: tabular,
  },
  mono: { fontSize: 11, fontFamily: fonts.mono, fontVariant: tabular },
} as const;
