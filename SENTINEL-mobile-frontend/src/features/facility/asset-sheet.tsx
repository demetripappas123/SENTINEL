import { Pressable, Text, View } from "react-native";
import { humanize, type InspectionDataset } from "@sentinel/core";
import { Badge, Sheet, severityTone } from "../../ui";
import { Icon } from "../../design/icons";
import { fonts, type Theme } from "../../design/tokens";
import { displayTime } from "../shared";

// Detail for one asset: its latest inspection, readings, and findings.
export function AssetSheet({
  assetId,
  data,
  colors,
  reducedMotion,
  onClose,
  onInspect,
}: {
  assetId: string | null;
  data: InspectionDataset;
  colors: Theme;
  reducedMotion: boolean;
  onClose: () => void;
  onInspect: (id: string) => void;
}) {
  const asset = data.assets.find((a) => a.asset_id === assetId);
  const actions = data.actions
    .filter((a) => a.asset_id === assetId)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  const latest = actions[0];
  const failed = actions.filter((a) => a.status === "FAILED").length;
  // Readings come from the most recent inspection that recorded any.
  const readingAction = actions.find((a) =>
    data.readings.some((r) => r.action_id === a.action_id),
  );
  const readings = readingAction
    ? data.readings.filter((r) => r.action_id === readingAction.action_id)
    : [];
  const findings = data.findings
    .filter((f) => f.asset_id === assetId)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  const location = data.locations.find(
    (l) => l.location_id === asset?.location_id,
  );
  const label = { fontSize: 11, color: colors.mutedForeground };
  const value = { fontSize: 13, color: colors.foreground };
  const section = {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.foreground,
    paddingTop: 16,
    paddingBottom: 6,
  };
  return (
    <Sheet
      title={asset?.asset_name ?? assetId ?? "Asset"}
      visible={!!assetId}
      colors={colors}
      reducedMotion={reducedMotion}
      onClose={onClose}
      closeLabel="Close asset"
      backdropLabel="Close asset details"
    >
      {asset && (
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Badge
              label={humanize(asset.criticality) + " criticality"}
              tone={severityTone(asset.criticality)}
              colors={colors}
            />
            <Badge
              label={humanize(asset.asset_type)}
              tone="outline"
              colors={colors}
            />
          </View>
          {(
            [
              ["Asset ID", asset.asset_id],
              [
                "Location",
                `${asset.location_id}${location ? " · " + location.location_name : ""}`,
              ],
              [
                "Last inspected",
                latest
                  ? `${displayTime(latest.timestamp)} · ${humanize(latest.status)}`
                  : "Never",
              ],
              ["Inspections", `${actions.length} · ${failed} failed`],
            ] as const
          ).map(([name, text]) => (
            <View
              key={name}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={label}>{name}</Text>
              <Text style={[value, { flexShrink: 1, textAlign: "right" }]}>
                {text}
              </Text>
            </View>
          ))}
          <Text accessibilityRole="header" style={section}>
            Latest readings
          </Text>
          {readings.length ? (
            readings.map((r) => (
              <View
                key={r.reading_id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 6,
                }}
              >
                <Text style={value}>{humanize(r.measurement_type)}</Text>
                <Text
                  style={[
                    value,
                    {
                      fontFamily: fonts.mono,
                      color:
                        r.quality === "GOOD"
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {r.value} {r.unit}
                  {r.quality === "GOOD" ? "" : ` · ${humanize(r.quality)}`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={label}>No readings recorded.</Text>
          )}
          <Text accessibilityRole="header" style={section}>
            Findings ({findings.length})
          </Text>
          {findings.length ? (
            findings.map((f) => (
              <Pressable
                key={f.anomaly_id}
                accessibilityRole="button"
                accessibilityLabel={`Inspect asset finding ${f.anomaly_id}`}
                onPress={() => {
                  onClose();
                  onInspect(f.anomaly_id);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 44,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.secondary : "transparent",
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[value, { fontWeight: "600", fontSize: 12 }]}>
                    {humanize(f.anomaly_type)}
                  </Text>
                  <Text
                    style={[label, { fontFamily: fonts.mono, fontSize: 10 }]}
                  >
                    {f.anomaly_id} · {displayTime(f.timestamp)}
                  </Text>
                </View>
                <Badge
                  label={humanize(f.severity)}
                  tone={severityTone(f.severity)}
                  colors={colors}
                />
                <Icon name="chevron" size={15} color={colors.mutedForeground} />
              </Pressable>
            ))
          ) : (
            <Text style={label}>No findings for this asset.</Text>
          )}
        </View>
      )}
    </Sheet>
  );
}
