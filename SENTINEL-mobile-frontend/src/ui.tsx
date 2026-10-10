import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import type { ThemeColors } from "@sentinel/core";

export function Button({
  label,
  onPress,
  colors,
  green = false,
  selected = false,
  accessibilityLabel,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  green?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: green
          ? colors.greenFill
          : selected
            ? colors.blueSoft
            : colors.surface,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: green ? "#214631" : selected ? colors.blue : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Badge({
  label,
  severity,
  colors,
}: {
  label: string;
  severity: string;
  colors: ThemeColors;
}) {
  const tone = ["CRITICAL", "HIGH"].includes(severity)
    ? "red"
    : severity === "MEDIUM"
      ? "amber"
      : severity === "SUCCESS"
        ? "green"
        : "blue";
  return (
    <View
      style={{
        borderRadius: 3,
        paddingHorizontal: 7,
        paddingVertical: 4,
        backgroundColor:
          colors[
            (tone + "Soft") as
              | "redSoft"
              | "amberSoft"
              | "greenSoft"
              | "blueSoft"
          ],
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 11, color: colors[tone] }}>{label}</Text>
    </View>
  );
}
export function Card({
  children,
  colors,
  style,
}: {
  children: ReactNode;
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          padding: 16,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          borderRadius: 4,
          marginBottom: 12,
          gap: 10,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export const layout = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  title: { fontSize: 15, fontWeight: "600" },
  small: { fontSize: 12 },
  mono: { fontSize: 11, fontVariant: ["tabular-nums"] },
});
