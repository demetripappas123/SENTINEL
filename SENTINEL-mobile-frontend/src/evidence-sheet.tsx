import { Image, Modal, ScrollView, Text, View } from "react-native";
import {
  actionFindings,
  assetName,
  humanize,
  locationName,
  missionActions,
  sampleImage,
  shortTime,
  type Action,
  type Finding,
  type Mission,
  type ThemeColors,
} from "@sentinel/core";
import { useInspectionData } from "./state/api-data";
import { Badge, Button, Card, layout } from "./ui";

const images: Record<string, number> = {
  "thermal_pump_bearing_01.jpg": require("../assets/demo/thermal_pump_bearing_01.jpg"),
  "acoustic_valve_01.jpg": require("../assets/demo/acoustic_valve_01.jpg"),
  "gauge_pressure_01.jpg": require("../assets/demo/gauge_pressure_01.jpg"),
  "visual_pump_motor_01.jpg": require("../assets/demo/visual_pump_motor_01.jpg"),
  "pipe_gallery_01.jpg": require("../assets/demo/pipe_gallery_01.jpg"),
};
export function EvidenceSheet({
  finding,
  mission,
  action,
  reviewed,
  colors,
  onClose,
  onReview,
  onAction,
}: {
  finding: Finding | null;
  mission: Mission | null;
  action: Action | null;
  reviewed: boolean;
  colors: ThemeColors;
  onClose: () => void;
  onReview: (id: string) => void;
  onAction: (action: Action) => void;
}) {
  const data = useInspectionData();
  const actions = mission ? missionActions(data, mission.mission_id) : [];
  const selectedAction = finding
    ? data.actions.find((a) => a.action_id === finding.action_id)
    : action;
  const readings = data.readings.filter(
    (r) => r.action_id === selectedAction?.action_id,
  );
  const linkedFindings =
    !finding && selectedAction ? actionFindings(data, selectedAction.action_id) : [];
  return (
    <Modal
      visible={!!finding || !!mission}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#11141899",
          justifyContent: "flex-end",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "90%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            padding: 20,
            paddingBottom: 32,
          }}
        >
          <View style={[layout.row, { marginBottom: 16 }]}>
            <Text
              accessibilityRole="header"
              style={[layout.title, { color: colors.ink, flex: 1 }]}
            >
              {finding
                ? humanize(finding.anomaly_type)
                : mission
                  ? "Route " + Number(mission.mission_id.slice(1))
                  : "Evidence"}
            </Text>
            <Button label="Close" colors={colors} onPress={onClose} />
          </View>
          <ScrollView>
            {finding && (
              <>
                <Badge
                  label={humanize(finding.severity)}
                  severity={finding.severity}
                  colors={colors}
                />
                <Text
                  style={[
                    layout.title,
                    { color: colors.ink, marginVertical: 12 },
                  ]}
                >
                  {assetName(data, finding.asset_id)}
                </Text>
                <Text
                  style={[
                    layout.small,
                    { color: colors.muted, marginBottom: 12 },
                  ]}
                >
                  {finding.mission_id} · {finding.location_id} ·{" "}
                  {locationName(data, finding.location_id)}
                </Text>
              </>
            )}
            {mission && (
              <>
                <Text
                  style={[
                    layout.title,
                    { color: colors.ink, marginBottom: 12 },
                  ]}
                >
                  {actions.filter((a) => a.status === "SUCCESS").length} /{" "}
                  {actions.length} successful
                </Text>
                {actions.map((a) => (
                  <Button
                    key={a.action_id}
                    label={
                      a.sequence +
                      ". " +
                      humanize(a.action_type) +
                      " · " +
                      a.action_id
                    }
                    colors={colors}
                    selected={a.action_id === action?.action_id}
                    onPress={() => onAction(a)}
                  />
                ))}
              </>
            )}
            {selectedAction && (
              <>
                <Image
                  source={
                    images[
                      sampleImage(
                        finding?.anomaly_type || selectedAction.action_type,
                      )
                    ]
                  }
                  resizeMode="cover"
                  accessibilityLabel="Illustrative inspection sample"
                  style={{
                    width: "100%",
                    height: 150,
                    marginTop: 16,
                    borderRadius: 3,
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.muted,
                    marginVertical: 8,
                  }}
                >
                  Kit illustration · not this record’s capture
                </Text>
                <Card colors={colors}>
                  <View style={layout.row}>
                    <Text style={{ color: colors.muted }}>Outcome</Text>
                    <Text style={{ color: colors.ink }}>
                      {humanize(selectedAction.status)}
                    </Text>
                  </View>
                  <View style={layout.row}>
                    <Text style={{ color: colors.muted }}>Battery</Text>
                    <Text style={{ color: colors.ink }}>
                      {selectedAction.battery_pct == null
                        ? "Pending"
                        : selectedAction.battery_pct + "%"}
                    </Text>
                  </View>
                  <Text style={[layout.small, { color: colors.muted }]}>
                    {shortTime(selectedAction.timestamp)}
                  </Text>
                  {selectedAction.status === "FAILED" && (
                    <Text style={{ color: colors.amber, fontWeight: "600" }}>
                      {selectedAction.failure_type
                        ? humanize(selectedAction.failure_type)
                        : "Pending"}
                    </Text>
                  )}
                </Card>
              </>
            )}
            {linkedFindings.map((f) => (
              <View
                key={f.anomaly_id}
                style={[layout.row, { paddingVertical: 12, gap: 12 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>
                    {humanize(f.anomaly_type)}
                  </Text>
                  <Text style={[layout.small, { color: colors.muted }]}>
                    {f.description}
                  </Text>
                </View>
                <Badge
                  label={humanize(f.severity)}
                  severity={f.severity}
                  colors={colors}
                />
              </View>
            ))}
            {readings.map((r) => (
              <View
                key={r.reading_id}
                style={[layout.row, { paddingVertical: 12 }]}
              >
                <View>
                  <Text style={{ color: colors.ink }}>
                    {humanize(r.measurement_type)}
                  </Text>
                  <Text style={[layout.small, { color: colors.muted }]}>
                    Quality: {humanize(r.quality)}
                  </Text>
                </View>
                <Text style={{ color: colors.ink, fontWeight: "600" }}>
                  {r.value} {r.unit}
                </Text>
              </View>
            ))}
            {!!selectedAction && !readings.length && (
              <Text
                style={[
                  layout.small,
                  { color: colors.muted, marginVertical: 12 },
                ]}
              >
                No reading recorded.
              </Text>
            )}
          </ScrollView>
          {finding && (
            <View style={{ gap: 8, paddingTop: 16 }}>
              <Text style={{ fontSize: 10, color: colors.muted }}>
                Review state: this session
              </Text>
              <Button
                label={reviewed ? "Reviewed" : "Mark reviewed"}
                colors={colors}
                green
                disabled={reviewed}
                onPress={() => {
                  onReview(finding.anomaly_id);
                  onClose();
                }}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
