import { Text, View, useWindowDimensions } from "react-native";
import { useMemo } from "react";
import { scopeDataset } from "@sentinel/core";
import { useInspection } from "../state/inspection-provider";
import { typography, type Theme } from "../design/tokens";

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
/** Web `PageHeading`: tight semibold title, muted subtitle, trailing controls. */
export function ScreenHeading({
  title,
  subtitle,
  colors,
  trailing,
}: {
  title: string;
  subtitle?: string;
  colors: Theme;
  trailing?: React.ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  return (
    <View
      style={{
        flexDirection: stacked ? "column" : "row",
        justifyContent: "space-between",
        alignItems: stacked ? "flex-start" : "flex-end",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <Text
          accessibilityRole="header"
          style={[typography.heading, { color: colors.foreground }]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: 13,
              color: colors.mutedForeground,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
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
export function displayTime(recorded: string | null | undefined) {
  const value = recorded || "";
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
