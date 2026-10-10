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
import { radii, typography } from "./design/tokens";

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
        borderRadius: radii.control,
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
          fontSize: 14,
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
  const tone =
    severity === "CRITICAL"
      ? "red"
      : ["HIGH", "MEDIUM"].includes(severity)
        ? "amber"
        : ["SUCCESS", "LOW"].includes(severity)
          ? "green"
          : "blue";
  return (
    <View
      style={{
        borderRadius: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
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
      <Text style={{ fontSize: 10, lineHeight: 12, color: colors[tone] }}>
        {label}
      </Text>
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
          borderRadius: radii.card,
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
  heading: { ...typography.heading, marginBottom: 16 },
  title: typography.title,
  small: typography.caption,
  mono: typography.mono,
});

export function SegmentedControl<T extends string>({
  options,
  value,
  colors,
  onChange,
}: {
  options: { value: T; label: string; accessibilityLabel?: string }[];
  value: T;
  colors: ThemeColors;
  onChange: (value: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        overflow: "hidden",
      }}
    >
      {options.map((option) => (
        <View key={option.value} style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={option.accessibilityLabel || option.label}
            accessibilityState={{ selected: value === option.value }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRightWidth: option === options.at(-1) ? 0 : 1,
              borderColor: colors.line,
              backgroundColor:
                value === option.value ? colors.blueSoft : colors.surface,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: value === option.value ? "600" : "400",
                color: value === option.value ? colors.blue : colors.ink,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
