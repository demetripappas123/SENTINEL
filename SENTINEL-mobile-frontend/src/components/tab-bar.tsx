import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import type { Tab } from "../navigation";
import { Icon } from "../design/icons";
import { selectionFeedback } from "../design/motion";
import { fonts, type Theme } from "../design/tokens";

function TabButton({
  value,
  label,
  count,
  unit,
  selected,
  colors,
  reducedMotion,
  onSelect,
}: {
  value: Tab;
  label: string;
  count: number;
  unit: string;
  selected: boolean;
  colors: Theme;
  reducedMotion: boolean;
  onSelect: (tab: Tab) => void;
}) {
  const emphasis = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(emphasis, {
      toValue: selected ? 1 : 0,
      duration: reducedMotion ? 0 : 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reducedMotion, emphasis]);
  const tint = selected ? colors.foreground : colors.mutedForeground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} tab, ${count} ${unit}`}
      accessibilityState={{ selected }}
      onPress={() => {
        if (!selected) {
          selectionFeedback();
          onSelect(value);
        }
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 58,
        paddingVertical: 7,
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      {/* Web nav marks the current route with a brand-colored rule. */}
      <Animated.View
        style={{
          position: "absolute",
          top: -1,
          height: 2,
          width: "56%",
          borderRadius: 1,
          backgroundColor: colors.brand,
          opacity: emphasis,
        }}
      />
      <Icon name={value} color={tint} size={20} />
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: selected ? "600" : "400",
            color: tint,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontFamily: fonts.mono,
            color: colors.mutedForeground,
            fontVariant: ["tabular-nums"],
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}
export function TabBar({
  tab,
  counts,
  colors,
  reducedMotion,
  onSelect,
}: {
  tab: Tab;
  counts: Record<Tab, number>;
  colors: Theme;
  reducedMotion: boolean;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.sidebar,
      }}
    >
      {(
        [
          ["attention", "Attention", "to review"],
          ["missions", "Missions", "missions"],
          ["facility", "Facility", "waypoints"],
        ] as const
      ).map(([value, label, unit]) => (
        <TabButton
          key={value}
          value={value}
          label={label}
          unit={unit}
          count={counts[value]}
          selected={tab === value}
          colors={colors}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
