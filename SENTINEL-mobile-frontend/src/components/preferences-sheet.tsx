import { useState } from "react";
import { Text, View } from "react-native";
import type { Appearance, Theme } from "../design/tokens";
import { Button, Overline, SegmentedControl, Sheet, layout } from "../ui";

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
  colors: Theme;
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
  return (
    <Sheet
      title="Preferences"
      colors={colors}
      reducedMotion={reducedMotion}
      onClose={onClose}
      closeLabel="Close preferences"
    >
      <Overline colors={colors}>Appearance</Overline>
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
          borderColor: colors.border,
          marginTop: 8,
          paddingTop: 20,
          gap: 12,
        }}
      >
        <Overline colors={colors}>Saved reviews</Overline>
        <Text
          style={[
            layout.small,
            { color: colors.mutedForeground, fontSize: 14 },
          ]}
        >
          {count
            ? `${count} ${count === 1 ? "review" : "reviews"} saved on this device.`
            : "No saved reviews on this device."}
        </Text>
        {confirming ? (
          <>
            <Text
              style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}
            >
              Clear all saved acknowledgments? Findings will return to the
              review queue. Inspection records and severity stay the same.
            </Text>
            <Button
              label={saving ? "Resetting…" : "Confirm reset"}
              accessibilityLabel="Confirm reset"
              variant="destructive"
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
            style={{ color: colors.destructive, fontSize: 14 }}
          >
            {error}
          </Text>
        )}
      </View>
    </Sheet>
  );
}
