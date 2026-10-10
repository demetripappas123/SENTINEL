import { Fragment, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import type { Waypoint } from "@sentinel/core";
import { facilityMap } from "../../assets";
import { alpha, type Theme } from "../../design/tokens";
import { MAP_ASPECT, floorRegions, mapLayout } from "./map-layout";

// Web `.map-hotspot` covers 8% × 14% of the plan around each waypoint pin.
const HOTSPOT = { width: 0.08, height: 0.14 };

export function FacilityMap({
  locations,
  selectedId,
  floor,
  onSelect,
  findingCounts,
  colors,
}: {
  locations: Waypoint[];
  selectedId: string | null;
  floor: number | null;
  onSelect: (id: string) => void;
  findingCounts: Record<string, number>;
  colors: Theme;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  return (
    <View
      onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
      style={{
        width: "100%",
        aspectRatio: MAP_ASPECT,
        backgroundColor: colors.secondary,
      }}
    >
      {/* iOS pinch-zoom and pan, the native counterpart of the web map's drag/zoom. */}
      <ScrollView
        maximumZoomScale={3.5}
        minimumZoomScale={1}
        bouncesZoom
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ width, height }}
      >
        <Image
          source={facilityMap[colors.mode]}
          accessibilityLabel="Illustrative fictional facility floor plan"
          style={{ position: "absolute", width, height }}
          resizeMode="stretch"
        />
        {floor !== null &&
          Object.entries(floorRegions)
            .filter(([value]) => Number(value) !== floor)
            .map(([value, region]) => (
              <View
                key={value}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: region.left * width,
                  width: (region.right - region.left) * width,
                  backgroundColor: alpha(colors.background, 0.72),
                }}
              />
            ))}
        {locations.map((location) => {
          const pos = mapLayout[location.location_id];
          if (!pos) return null;
          const selected = location.location_id === selectedId;
          const boxWidth = HOTSPOT.width * width;
          const boxHeight = HOTSPOT.height * height;
          const left = pos.x * width;
          const top = pos.y * height;
          return (
            <Fragment key={location.location_id}>
              {selected && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: left - boxWidth / 2,
                    top: top - boxHeight / 2,
                    width: boxWidth,
                    height: boxHeight,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: colors.brand,
                    backgroundColor: alpha(colors.brand, 0.22),
                  }}
                />
              )}
              {!!findingCounts[location.location_id] && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: left + boxWidth / 2 - 5,
                    top: top - boxHeight / 2 - 3,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    // Neutral, so it is not mistaken for the plan's red "Critical" pins.
                    backgroundColor: colors.primary,
                    borderWidth: 1.5,
                    borderColor: colors.background,
                  }}
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Map waypoint ${location.location_id} ${location.location_name}`}
                accessibilityState={{ selected }}
                accessibilityHint={`${findingCounts[location.location_id] || 0} findings`}
                onPress={() => onSelect(location.location_id)}
                hitSlop={4}
                style={{
                  position: "absolute",
                  left: left - 20,
                  top: top - 20,
                  width: 40,
                  height: 40,
                }}
              />
            </Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}
