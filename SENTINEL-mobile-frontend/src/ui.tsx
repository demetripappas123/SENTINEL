import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha, radii, typography, type Theme } from "./design/tokens";
import { Icon, type IconName } from "./design/icons";

// Same variant names as the web's shadcn Button.
export type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive";

export function Button({
  label,
  onPress,
  colors,
  variant = "outline",
  icon,
  selected = false,
  accessibilityLabel,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  colors: Theme;
  variant?: ButtonVariant;
  icon?: IconName;
  selected?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fill: Record<ButtonVariant, [string, string, string]> = {
    // [background, border, text]
    default: [colors.primary, colors.primary, colors.primaryForeground],
    outline: [colors.background, colors.input, colors.foreground],
    secondary: [colors.secondary, colors.secondary, colors.foreground],
    ghost: ["transparent", "transparent", colors.foreground],
    destructive: [
      alpha(colors.destructive, 0.1),
      "transparent",
      colors.destructive,
    ],
  };
  const [background, border, text] = selected
    ? [alpha(colors.brand, 0.1), colors.brand, colors.brand]
    : fill[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 14,
          flexDirection: "row",
          gap: 6,
          borderWidth: 1,
          borderColor: border,
          borderRadius: radii.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: background,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} color={text} size={16} />}
      <Text
        style={{
          fontSize: 14,
          fontWeight: selected ? "600" : "500",
          color: text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Square, icon-only ghost button (web `Button className="quiet square"`). */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  colors,
  bordered = false,
  color,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  colors: Theme;
  bordered?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radii.md,
        borderWidth: bordered ? 1 : 0,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.muted : "transparent",
      })}
    >
      <Icon name={icon} color={color || colors.mutedForeground} size={18} />
    </Pressable>
  );
}

// Web `Tag` tones map onto shadcn Badge variants; keep the same mapping here.
export type BadgeTone = "default" | "destructive" | "secondary" | "outline";
export const severityTone = (severity: string): BadgeTone =>
  ["CRITICAL", "HIGH"].includes(severity)
    ? "destructive"
    : severity === "MEDIUM"
      ? "secondary"
      : "outline";
export const statusTone = (status: string): BadgeTone =>
  status === "COMPLETED"
    ? "default"
    : status === "FAILED"
      ? "destructive"
      : status === "IN_PROGRESS"
        ? "secondary"
        : "outline";

export function Badge({
  label,
  tone = "default",
  colors,
}: {
  label: string;
  tone?: BadgeTone;
  colors: Theme;
}) {
  const [background, border, text] = {
    default: [colors.primary, colors.primary, colors.primaryForeground],
    destructive: [
      alpha(colors.destructive, 0.1),
      "transparent",
      colors.destructive,
    ],
    secondary: [colors.secondary, colors.secondary, colors.foreground],
    outline: ["transparent", colors.border, colors.foreground],
  }[tone];
  return (
    <View
      style={{
        height: 20,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: border,
        paddingHorizontal: 8,
        justifyContent: "center",
        backgroundColor: background,
        alignSelf: "flex-start",
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontSize: 11, fontWeight: "500", color: text }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Removable filter pill, like an active filter tag on web. */
export function FilterChip({
  label,
  accessibilityLabel,
  colors,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  colors: Theme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        minHeight: 28,
        paddingLeft: 10,
        paddingRight: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.muted : colors.secondary,
      })}
    >
      <Text
        style={{ color: colors.foreground, fontSize: 12, fontWeight: "500" }}
      >
        {label}
      </Text>
      <Icon name="close" color={colors.mutedForeground} size={13} />
    </Pressable>
  );
}

export function Card({
  children,
  colors,
  style,
}: {
  children: ReactNode;
  colors: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderRadius: radii.xl,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Web `Panel`: card with a bordered header, optional action and muted footer. */
export function Panel({
  title,
  icon,
  action,
  footer,
  children,
  colors,
  style,
  headerStyle,
}: {
  title: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  colors: Theme;
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <Card colors={colors} style={[{ marginBottom: 16 }, style]}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 46,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: colors.border,
          },
          headerStyle,
        ]}
      >
        {icon && <Icon name={icon} color={colors.foreground} size={16} />}
        {typeof title === "string" ? (
          <Text
            numberOfLines={1}
            style={[layout.title, { color: colors.foreground, flex: 1 }]}
          >
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }}>{title}</View>
        )}
        {action}
      </View>
      {children}
      {footer && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderColor: colors.border,
            backgroundColor: alpha(colors.muted, 0.5),
          }}
        >
          {footer}
        </View>
      )}
    </Card>
  );
}

export function Overline({
  children,
  colors,
  style,
}: {
  children: ReactNode;
  colors: Theme;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[typography.overline, { color: colors.mutedForeground }, style]}
    >
      {children}
    </Text>
  );
}

export const layout = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heading: typography.heading,
  title: typography.title,
  small: typography.small,
  caption: typography.caption,
  mono: typography.mono,
});

/** Web `ToggleGroup`: muted track, brand fill on the selected item. */
export function SegmentedControl<T extends string>({
  options,
  value,
  colors,
  onChange,
}: {
  options: { value: T; label: string; accessibilityLabel?: string }[];
  value: T;
  colors: Theme;
  onChange: (value: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 2,
        padding: 2,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondary,
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.accessibilityLabel || option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: radii.sm - 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: selected ? colors.brand : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: selected ? "600" : "500",
                color: selected
                  ? colors.brandForeground
                  : colors.mutedForeground,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Bottom sheet modal shared by preferences, filters, dates, and floors.
 * The header close button keeps each sheet's accessible name.
 */
export function Sheet({
  title,
  colors,
  reducedMotion,
  onClose,
  closeLabel,
  backdropLabel,
  keyboard = false,
  visible = true,
  children,
  footer,
}: {
  title: string;
  colors: Theme;
  reducedMotion: boolean;
  onClose: () => void;
  closeLabel?: string;
  backdropLabel?: string;
  keyboard?: boolean;
  visible?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const Container = keyboard ? KeyboardAvoidingView : View;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <Container
        {...(keyboard ? { behavior: "padding" as const } : {})}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
      >
        {backdropLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backdropLabel}
            onPress={onClose}
            style={{ flex: 1 }}
          />
        ) : null}
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "90%",
            backgroundColor: colors.background,
            borderTopLeftRadius: radii.xl + 6,
            borderTopRightRadius: radii.xl + 6,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              marginTop: 8,
              backgroundColor: colors.border,
            }}
          />
          <View
            style={[
              layout.row,
              {
                paddingLeft: 20,
                paddingRight: 12,
                paddingTop: 10,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 17,
                fontWeight: "600",
                letterSpacing: -0.3,
                color: colors.foreground,
              }}
            >
              {title}
            </Text>
            {closeLabel && (
              <IconButton
                icon="close"
                accessibilityLabel={closeLabel}
                onPress={onClose}
                colors={colors}
                bordered
              />
            )}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            {children}
          </ScrollView>
          {footer && (
            <View
              style={{
                gap: 8,
                paddingHorizontal: 20,
                paddingTop: 12,
                borderTopWidth: 1,
                borderColor: colors.border,
              }}
            >
              {footer}
            </View>
          )}
        </View>
      </Container>
    </Modal>
  );
}
