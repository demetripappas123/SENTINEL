import { palette, type ThemeColors } from "@sentinel/core";
import type { TextStyle } from "react-native";

export type Appearance = "light" | "dark";
export const colors: Record<Appearance, ThemeColors> = {
  light: {
    ...palette.light,
    background: "#f5f8fc",
    ink: "#101c32",
    muted: "#64748b",
    line: "#e0e7ef",
    blue: "#086abd",
    blueSoft: "#e6f1fc",
  },
  dark: { ...palette.dark, background: "#131d2c", surface: "#1b293c" },
};
export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 };
export const radii = { control: 6, card: 8, sheet: 20 };
export const typography = {
  heading: { fontSize: 28, fontWeight: "600", letterSpacing: -0.8 },
  title: { fontSize: 16, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 17 },
  mono: {
    fontSize: 12,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
} as const;
