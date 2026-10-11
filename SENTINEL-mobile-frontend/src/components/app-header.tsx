import {
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { Appearance, Theme } from "../design/tokens";
import { IconButton } from "../ui";
import { brandLogo } from "../assets";

export function AppHeader({
  colors,
  appearance,
  onToggleAppearance,
  onPreferences,
}: {
  colors: Theme;
  appearance: Appearance;
  onToggleAppearance: () => void;
  onPreferences: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const showContext = width >= 375 && fontScale <= 1.3;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        paddingLeft: 16,
        paddingRight: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: 12,
      }}
    >
      <View
        accessible
        accessibilityLabel="SENTINEL"
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <Image
          source={brandLogo}
          accessible={false}
          resizeMode="contain"
          style={{ width: 20, height: 22, tintColor: colors.foreground }}
        />
        <Text
          allowFontScaling={false}
          style={{
            color: colors.foreground,
            fontSize: 15,
            fontWeight: "600",
            letterSpacing: 0.6,
          }}
        >
          SENTINEL
        </Text>
      </View>
      {showContext && (
        <>
          <View
            style={{
              height: 20,
              borderLeftWidth: 1,
              borderColor: colors.border,
            }}
          />
          <Text
            accessibilityLabel="NextEra, SPOT operations"
            style={{ fontSize: 12, color: colors.mutedForeground }}
          >
            NextEra / SPOT
          </Text>
        </>
      )}
      <View style={{ flex: 1 }} />
      <IconButton
        icon={appearance === "light" ? "moon" : "sun"}
        accessibilityLabel={`Switch to ${appearance === "light" ? "dark" : "light"} appearance`}
        onPress={onToggleAppearance}
        colors={colors}
      />
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
            width: 30,
            height: 30,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontSize: 10,
              fontWeight: "500",
              color: colors.foreground,
            }}
          >
            OP
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
