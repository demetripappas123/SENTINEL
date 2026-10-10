import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { validateDateRange, type DateRange } from "@sentinel/core";
import { Button, Sheet } from "../../ui";
import { useReducedMotion } from "../../design/motion";
import { fonts, radii, type Theme } from "../../design/tokens";

export function DateRangeSheet({
  colors,
  initial,
  onApply,
  onClose,
}: {
  colors: Theme;
  initial: { start: string; end: string };
  onApply: (range: DateRange) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(initial.start),
    [end, setEnd] = useState(initial.end),
    [error, setError] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const pickerText = picker === "start" ? start : end;
  const pickerDate = new Date(`${pickerText}T12:00:00`);
  return (
    <Sheet
      title="Mission dates"
      colors={colors}
      reducedMotion={reduced}
      onClose={onClose}
      closeLabel="Close"
      keyboard
      footer={
        <>
          <Button
            label="Apply dates"
            variant="default"
            colors={colors}
            onPress={() => {
              try {
                const range = { start, end };
                validateDateRange(range);
                onApply(range);
                onClose();
              } catch {
                setError(
                  "Choose valid dates with the end on or after the start.",
                );
              }
            }}
          />
          <Button
            label="All dates"
            colors={colors}
            onPress={() => {
              onApply(null);
              onClose();
            }}
          />
        </>
      }
    >
      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
        Choose recorded dates (YYYY-MM-DD). All evidence from matching missions
        is included.
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {(
          [
            ["Start date", start, setStart, "start"],
            ["End date", end, setEnd, "end"],
          ] as const
        ).map(([label, value, onChange, kind]) => (
          <View key={label} style={{ flex: 1, gap: 6 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              {label}
            </Text>
            <TextInput
              accessibilityLabel={label}
              value={value}
              onChangeText={onChange}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              style={{
                minHeight: 44,
                borderWidth: 1,
                borderColor: picker === kind ? colors.ring : colors.input,
                borderRadius: radii.md,
                paddingHorizontal: 12,
                color: colors.foreground,
                fontFamily: fonts.mono,
                fontSize: 13,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          label="Choose start date"
          colors={colors}
          selected={picker === "start"}
          style={{ flex: 1 }}
          onPress={() => setPicker("start")}
        />
        <Button
          label="Choose end date"
          colors={colors}
          selected={picker === "end"}
          style={{ flex: 1 }}
          onPress={() => setPicker("end")}
        />
      </View>
      {picker && (
        <DateTimePicker
          accessibilityLabel={`Pick ${picker} date`}
          mode="date"
          display="spinner"
          themeVariant={colors.mode}
          value={
            Number.isFinite(pickerDate.getTime()) ? pickerDate : new Date()
          }
          onValueChange={(_, date) => {
            const recorded = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            (picker === "start" ? setStart : setEnd)(recorded);
          }}
        />
      )}
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.destructive, fontSize: 13 }}
        >
          {error}
        </Text>
      )}
    </Sheet>
  );
}
