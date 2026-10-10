import { Modal, ScrollView, Text, View } from "react-native";
import { humanize, type ThemeColors } from "@sentinel/core";
import { Button, layout } from "../../ui";
import { useReducedMotion } from "../../design/motion";

export function FiltersSheet({
  colors,
  severity,
  types,
  availableTypes,
  onSeverity,
  onTypes,
  onClose,
}: {
  colors: ThemeColors;
  severity: string | null;
  types: string[];
  availableTypes: string[];
  onSeverity: (value: string | null) => void;
  onTypes: (value: string[]) => void;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Modal
      transparent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#10182c66",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "85%",
            backgroundColor: colors.surface,
            padding: 22,
            paddingBottom: 36,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            gap: 12,
          }}
        >
          <View style={layout.row}>
            <Text
              accessibilityRole="header"
              style={[layout.title, { color: colors.ink }]}
            >
              Finding filters
            </Text>
            <Button label="Close filters" colors={colors} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            <Text style={{ color: colors.muted }}>SEVERITY</Text>
            {[null, "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => (
              <Button
                key={value || "all"}
                label={value ? humanize(value) : "Any severity"}
                selected={severity === value}
                colors={colors}
                onPress={() => onSeverity(value)}
              />
            ))}
            <Text style={{ color: colors.muted, marginTop: 12 }}>
              FINDING TYPE
            </Text>
            {availableTypes.map((value) => (
              <Button
                key={value}
                label={humanize(value)}
                selected={types.includes(value)}
                colors={colors}
                onPress={() =>
                  onTypes(
                    types.includes(value)
                      ? types.filter((v) => v !== value)
                      : [...types, value],
                  )
                }
              />
            ))}
          </ScrollView>
          <Button
            label="Clear filters"
            colors={colors}
            onPress={() => {
              onSeverity(null);
              onTypes([]);
            }}
          />
          <Button label="Show findings" colors={colors} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
