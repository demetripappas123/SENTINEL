import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  validateDateRange,
  type DateRange,
  type ThemeColors,
} from "@sentinel/core";
import { Button, layout } from "../../ui";
import { useReducedMotion } from "../../design/motion";

export function DateRangeSheet({
  colors,
  initial,
  onApply,
  onClose,
}: {
  colors: ThemeColors;
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
    <Modal
      transparent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={{
          flex: 1,
          backgroundColor: "#10182c66",
          justifyContent: "flex-end",
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{
            maxHeight: "90%",
            flexGrow: 0,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
          contentContainerStyle={{ padding: 22, paddingBottom: 38, gap: 16 }}
          accessibilityViewIsModal
        >
          <View style={layout.row}>
            <Text
              accessibilityRole="header"
              style={[layout.title, { color: colors.ink }]}
            >
              Mission dates
            </Text>
            <Button label="Close" colors={colors} onPress={onClose} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Choose recorded dates (YYYY-MM-DD). All evidence from matching
            missions is included.
          </Text>
          {(
            [
              ["Start date", start, setStart],
              ["End date", end, setEnd],
            ] as const
          ).map(([label, value, onChange]) => (
            <View key={label} style={{ gap: 7 }}>
              <Text style={{ color: colors.ink }}>{label}</Text>
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
                  borderColor: colors.line,
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  color: colors.ink,
                }}
              />
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              label="Choose start date"
              colors={colors}
              onPress={() => setPicker("start")}
            />
            <Button
              label="Choose end date"
              colors={colors}
              onPress={() => setPicker("end")}
            />
          </View>
          {picker && (
            <DateTimePicker
              accessibilityLabel={`Pick ${picker} date`}
              mode="date"
              display="spinner"
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
            <Text accessibilityRole="alert" style={{ color: colors.red }}>
              {error}
            </Text>
          )}
          <Button
            label="Apply dates"
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
