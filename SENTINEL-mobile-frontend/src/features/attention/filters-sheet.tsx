import { View } from "react-native";
import { humanize } from "@sentinel/core";
import { Button, Overline, Sheet } from "../../ui";
import { useReducedMotion } from "../../design/motion";
import type { Theme } from "../../design/tokens";

export function FiltersSheet({
  colors,
  severity,
  types,
  availableTypes,
  onSeverity,
  onTypes,
  onClose,
}: {
  colors: Theme;
  severity: string | null;
  types: string[];
  availableTypes: string[];
  onSeverity: (value: string | null) => void;
  onTypes: (value: string[]) => void;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const chips = { flexDirection: "row", flexWrap: "wrap", gap: 8 } as const;
  return (
    <Sheet
      title="Finding filters"
      colors={colors}
      reducedMotion={reduced}
      onClose={onClose}
      closeLabel="Close filters"
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label="Clear filters"
            colors={colors}
            style={{ flex: 1 }}
            onPress={() => {
              onSeverity(null);
              onTypes([]);
            }}
          />
          <Button
            label="Show findings"
            variant="default"
            colors={colors}
            style={{ flex: 1 }}
            onPress={onClose}
          />
        </View>
      }
    >
      <Overline colors={colors}>Severity</Overline>
      <View style={chips}>
        {[null, "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => (
          <Button
            key={value || "all"}
            label={value ? humanize(value) : "Any severity"}
            selected={severity === value}
            colors={colors}
            onPress={() => onSeverity(value)}
          />
        ))}
      </View>
      <Overline colors={colors} style={{ marginTop: 8 }}>
        Finding type
      </Overline>
      <View style={chips}>
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
      </View>
    </Sheet>
  );
}
