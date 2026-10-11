import { useEffect, useRef } from "react";
import { Animated, Image, Text, View } from "react-native";
import { brandLogo } from "../assets";
import { radii, type Theme } from "../design/tokens";

export function LoadingScreen({
  colors,
  reducedMotion,
}: {
  colors: Theme;
  reducedMotion: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);
  const skeleton = { backgroundColor: colors.muted, borderRadius: radii.xl };
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 14,
          marginBottom: 12,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Image
          source={brandLogo}
          accessible={false}
          resizeMode="contain"
          style={{ width: 20, height: 22, tintColor: colors.foreground }}
        />
        <Text
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
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading inspections"
        style={{ gap: 6, marginBottom: 16 }}
      >
        <Text style={{ fontSize: 14, color: colors.foreground }}>
          Loading inspection data…
        </Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
          Fetching missions, results, and review priorities.
        </Text>
      </View>
      <Animated.View
        style={{ opacity: pulse, gap: 12 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[skeleton, { flex: 1, height: 112 }]} />
          ))}
        </View>
        <View style={[skeleton, { height: 210 }]} />
        <View style={[skeleton, { height: 46 }]} />
        <View style={[skeleton, { height: 260 }]} />
      </Animated.View>
    </View>
  );
}
