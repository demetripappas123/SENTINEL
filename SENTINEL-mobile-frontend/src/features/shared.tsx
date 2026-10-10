import { Text, View, useWindowDimensions } from "react-native";
import { useMemo } from "react";
import { scopeDataset, type ThemeColors } from "@sentinel/core";
import { useInspection } from "../state/inspection-provider";

export function useScreenData() {
  const state = useInspection();
  const data = useMemo(
    () => scopeDataset(state.data!, state.range),
    [state.data, state.range],
  );
  const { width, fontScale } = useWindowDimensions();
  return {
    ...state,
    data,
    scale: Math.max(0.85, Math.min(width / 426.5, 1.08)),
    largeText: fontScale > 1.3,
    reviewedIds: state.reviews.map((r) => r.findingId),
  };
}
export function ScreenHeading({
  title,
  subtitle,
  colors,
  scale,
  trailing,
}: {
  title: string;
  subtitle?: string;
  colors: ThemeColors;
  scale: number;
  trailing?: React.ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ marginBottom: 13 * scale }}>
      <Text
        style={{
          fontSize: 9 * scale,
          color: colors.muted,
          letterSpacing: 1.7,
          marginBottom: 6 * scale,
        }}
      >
        OPERATIONS
      </Text>
      <View
        style={{
          flexDirection: fontScale > 1.3 ? "column" : "row",
          justifyContent: "space-between",
          alignItems: fontScale > 1.3 ? "flex-start" : "center",
          gap: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 27 * scale,
            lineHeight: 32 * scale,
            fontWeight: "700",
            letterSpacing: -1,
            color: colors.ink,
          }}
        >
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle && (
        <Text
          style={{
            fontSize: 12 * scale,
            color: colors.muted,
            marginTop: 5 * scale,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function displayTime(value: string) {
  const month = months[Number(value.slice(5, 7)) - 1];
  return month
    ? `${month} ${Number(value.slice(8, 10))} ${value.slice(11, 16)}`.trim()
    : value || "Not recorded";
}
export function displayDateRange(start: string, end: string) {
  if (!start || !end) return "All dates";
  const month = months[Number(start.slice(5, 7)) - 1];
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${month} ${Number(start.slice(8, 10))}–${Number(end.slice(8, 10))}, ${start.slice(0, 4)}`
    : `${start} – ${end}`;
}
