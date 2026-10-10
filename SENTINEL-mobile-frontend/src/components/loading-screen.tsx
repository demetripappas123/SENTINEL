import { useEffect, useRef } from "react";
import { Animated, Image, Text, View, useWindowDimensions } from "react-native";
import type { ThemeColors } from "@sentinel/core";

export function LoadingScreen({
  colors,
  reducedMotion,
}: {
  colors: ThemeColors;
  reducedMotion: boolean;
}) {
  const { width } = useWindowDimensions();
  const scale = Math.min(width / 426.5, 1.08);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
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
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 32 }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <Animated.View style={{ opacity: pulse }}>
          <Image
            source={require("../../assets/design/shield-scanner.png")}
            accessible={false}
            resizeMode="contain"
            style={{
              width: 150 * scale,
              height: 110 * scale,
              transform: [{ translateX: -25 * scale }],
            }}
          />
        </Animated.View>
        <Text
          style={{
            color: colors.ink,
            fontSize: 22 * scale,
            letterSpacing: 8 * scale,
            fontWeight: "700",
          }}
        >
          SENTINEL
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 11,
            textAlign: "center",
            letterSpacing: 0.6,
            fontFamily: "Menlo",
          }}
        >
          Inspection reliability · SPOT operations
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading inspections"
        style={{ gap: 12, marginBottom: 18, alignItems: "center" }}
      >
        <View
          style={{
            height: 3,
            width: 140 * scale,
            borderRadius: 2,
            overflow: "hidden",
            backgroundColor: colors.line,
          }}
        >
          <Animated.View
            style={{
              height: 3,
              width: "46%",
              backgroundColor: colors.blue,
              opacity: pulse,
            }}
          />
        </View>
      </View>
      <Text
        style={{
          textAlign: "center",
          color: colors.muted,
          fontSize: 11,
          letterSpacing: 1,
          marginBottom: 30,
          fontFamily: "Menlo",
        }}
      >
        NextEra / SPOT
      </Text>
    </View>
  );
}
