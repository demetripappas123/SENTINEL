import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import type { ThemeColors } from "@sentinel/core";
import type { Tab } from "../navigation";
import { Icon } from "../design/icons";
import { selectionFeedback } from "../design/motion";

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
  colors: ThemeColors;
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
        minHeight: 60,
        paddingVertical: 6,
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          height: 2,
          width: "100%",
          backgroundColor: colors.blue,
          opacity: emphasis,
        }}
      />
      <Icon
        name={value}
        color={selected ? colors.blue : colors.muted}
        size={20}
      />
      <Text
        style={{
          fontSize: 11,
          fontWeight: selected ? "600" : "400",
          color: selected ? colors.blue : colors.muted,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: selected ? colors.blue : colors.muted,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
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
  colors: ThemeColors;
  reducedMotion: boolean;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
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
