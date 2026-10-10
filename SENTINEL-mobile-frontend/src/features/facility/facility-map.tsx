import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import type { ThemeColors, Waypoint } from "@sentinel/core";
import { mapLayout } from "./map-layout";

export function FacilityMap({
  locations,
  selectedId,
  onSelect,
  findingCounts,
  colors,
}: {
  locations: Waypoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  findingCounts: Record<string, number>;
  colors: ThemeColors;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 7,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <View
        onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
        style={{ width: "100%", aspectRatio: 748 / 604 }}
      >
        <Image
          source={require("../../../assets/design/facility-reference.png")}
          accessible={false}
          style={{ position: "absolute", width: "100%", height: "100%" }}
          resizeMode="contain"
        />
        {/* Covers the reference's fixed selected halo; selection comes from state. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: mapLayout.WP05.x * size.width - 20,
            top: mapLayout.WP05.y * size.height - 20,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
          }}
        />
        {locations.map((location) => {
          const pos = mapLayout[location.location_id];
          if (!pos) return null;
          const selected = location.location_id === selectedId;
          return (
            <Pressable
              key={location.location_id}
              accessibilityRole="button"
              accessibilityLabel={`Map waypoint ${location.location_id} ${location.location_name}`}
              accessibilityState={{ selected }}
              accessibilityHint={`${findingCounts[location.location_id] || 0} findings`}
              onPress={() => onSelect(location.location_id)}
              style={{
                position: "absolute",
                left: pos.x * size.width - 22,
                top: pos.y * size.height - 22,
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: colors.ink,
                    opacity: 0.08,
                  }}
                />
              )}
              <View
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: selected ? colors.ink : "#aab7ca",
                  backgroundColor: selected ? colors.ink : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: selected ? colors.surface : colors.ink,
                    fontWeight: "600",
                    fontSize: 10,
                  }}
                >
                  {location.location_id.replace(/^WP/, "")}
                </Text>
              </View>
              {!!findingCounts[location.location_id] && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    right: 7,
                    top: 7,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.red,
                    borderWidth: 1,
                    borderColor: colors.surface,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
