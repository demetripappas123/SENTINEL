import { Pressable, Text, View, useWindowDimensions } from "react-native";
import type { ThemeColors } from "@sentinel/core";
import { Icon } from "../design/icons";
import type { Appearance } from "../design/tokens";

export function AppHeader({
  colors,
  appearance,
  onToggleAppearance,
  onPreferences,
}: {
  colors: ThemeColors;
  appearance: Appearance;
  onToggleAppearance: () => void;
  onPreferences: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 46,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: colors.line,
        gap: 8,
      }}
    >
      <View
        accessible
        accessibilityLabel="SENTINEL"
        style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
      >
        <Icon name="shield" color={colors.ink} size={17} />
        <Text
          allowFontScaling={false}
          style={{
            color: colors.ink,
            fontSize: 13,
            fontWeight: "700",
            letterSpacing: 1.3,
          }}
        >
          SENTINEL
        </Text>
      </View>
      <View
        style={{
          height: 15,
          borderLeftWidth: 1,
          borderColor: colors.line,
          marginHorizontal: 3,
        }}
      />
      {width >= 375 && fontScale <= 1.3 && (
        <View
          accessible
          accessibilityLabel="NextEra, SPOT operations"
          style={{ flex: 1, alignItems: "flex-start", marginLeft: 6 }}
        >
          <Text style={{ fontSize: 10, color: colors.muted }}>
            NextEra / SPOT
          </Text>
        </View>
      )}
      {(width < 375 || fontScale > 1.3) && <View style={{ flex: 1 }} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${appearance === "light" ? "dark" : "light"} appearance`}
        onPress={onToggleAppearance}
        style={({ pressed }) => ({
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon
          name={appearance === "light" ? "moon" : "sun"}
          color={colors.muted}
          size={19}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open preferences"
        onPress={onPreferences}
        style={({ pressed }) => ({
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.blueSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            allowFontScaling={false}
            style={{ fontSize: 11, fontWeight: "600", color: colors.blue }}
          >
            OP
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
