import { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ThemeColors } from "@sentinel/core";
import type { Appearance } from "../design/tokens";
import { Button, SegmentedControl, layout } from "../ui";

export function PreferencesSheet({
  colors,
  appearance,
  reducedMotion,
  count,
  saving,
  error,
  onAppearance,
  onReset,
  onClose,
}: {
  colors: ThemeColors;
  appearance: Appearance;
  reducedMotion: boolean;
  count: number;
  saving: boolean;
  error: string | null;
  onAppearance: (appearance: Appearance) => void;
  onReset: () => Promise<void>;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#0b142b66",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: Math.max(insets.bottom, 20),
            maxHeight: "90%",
          }}
        >
          <View style={[layout.row, { marginBottom: 20 }]}>
            <Text
              accessibilityRole="header"
              style={[layout.title, { color: colors.ink }]}
            >
              Preferences
            </Text>
            <Button
              label="Close"
              accessibilityLabel="Close preferences"
              colors={colors}
              onPress={onClose}
            />
          </View>
          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              APPEARANCE
            </Text>
            <SegmentedControl
              options={[
                {
                  value: "light",
                  label: "Light",
                  accessibilityLabel: "Light appearance",
                },
                {
                  value: "dark",
                  label: "Dark",
                  accessibilityLabel: "Dark appearance",
                },
              ]}
              value={appearance}
              colors={colors}
              onChange={onAppearance}
            />
            <View
              style={{
                borderTopWidth: 1,
                borderColor: colors.line,
                paddingTop: 20,
                gap: 12,
              }}
            >
              <Text style={[layout.title, { color: colors.ink }]}>
                Saved reviews
              </Text>
              <Text
                style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}
              >
                {count
                  ? `${count} ${count === 1 ? "review" : "reviews"} saved on this device.`
                  : "No saved reviews on this device."}
              </Text>
              {confirming ? (
                <>
                  <Text
                    style={{ color: colors.ink, fontSize: 14, lineHeight: 20 }}
                  >
                    Clear all saved acknowledgments? Findings will return to the
                    review queue. Inspection records and severity stay the same.
                  </Text>
                  <Button
                    label={saving ? "Resetting…" : "Confirm reset"}
                    accessibilityLabel="Confirm reset"
                    disabled={saving}
                    colors={colors}
                    onPress={() => {
                      void onReset()
                        .then(() => setConfirming(false))
                        .catch(() => undefined);
                    }}
                  />
                  <Button
                    label="Keep reviews"
                    disabled={saving}
                    colors={colors}
                    onPress={() => setConfirming(false)}
                  />
                </>
              ) : (
                <Button
                  label="Reset saved reviews"
                  colors={colors}
                  onPress={() => setConfirming(true)}
                />
              )}
              {error && (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.red, fontSize: 14 }}
                >
                  {error}
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
