import { Image, Pressable, Text, TextInput, View } from "react-native";
import {
  assetName,
  dataset,
  getFindings,
  humanize,
  missionActions,
  shortTime,
  type Finding,
  type FindingStatus,
  type Mission,
  type ThemeColors,
} from "@sentinel/core";
import { Badge, Button, Card, layout } from "./ui";

export function Attention({
  colors,
  query,
  setQuery,
  status,
  setStatus,
  reviewedIds,
  onInspect,
}: {
  colors: ThemeColors;
  query: string;
  setQuery: (value: string) => void;
  status: FindingStatus;
  setStatus: (value: FindingStatus) => void;
  reviewedIds: string[];
  onInspect: (finding: Finding) => void;
}) {
  const pending = getFindings(dataset, { reviewedIds });
  const findings = getFindings(dataset, { query, status, reviewedIds });
  return (
    <>
      <Text
        accessibilityRole="header"
        style={[layout.heading, { color: colors.ink }]}
      >
        Attention
      </Text>
      <View style={[layout.row, { marginBottom: 20 }]}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <Text
            style={{
              color: colors.blue,
              fontSize: 38,
              fontWeight: "600",
              letterSpacing: -1,
            }}
          >
            {pending.length}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>to review</Text>
        </View>
        <Badge
          colors={colors}
          severity="CRITICAL"
          label={
            pending.filter((f) => f.severity === "CRITICAL").length +
            " critical"
          }
        />
      </View>
      <TextInput
        accessibilityLabel="Search findings"
        placeholder="Asset or waypoint"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={{
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 4,
          padding: 12,
          minHeight: 44,
          color: colors.ink,
          backgroundColor: colors.surface,
          marginBottom: 12,
        }}
      />
      <View style={[layout.row, { marginBottom: 16 }]}>
        {(
          [
            ["required", "To review"],
            ["all", "All"],
            ["reviewed", "Reviewed"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            label={label}
            colors={colors}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>
      {!findings.length && (
        <Text
          accessibilityRole="text"
          style={{
            color: colors.muted,
            paddingVertical: 30,
            textAlign: "center",
          }}
        >
          No matching findings
        </Text>
      )}
      {findings.map((f) => (
        <Card
          key={f.anomaly_id}
          colors={colors}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: ["CRITICAL", "HIGH"].includes(f.severity)
              ? colors.red
              : f.severity === "MEDIUM"
                ? colors.amber
                : colors.blue,
          }}
        >
          <View style={layout.row}>
            <Badge
              label={
                reviewedIds.includes(f.anomaly_id)
                  ? "Reviewed"
                  : humanize(f.severity)
              }
              severity={
                reviewedIds.includes(f.anomaly_id) ? "SUCCESS" : f.severity
              }
              colors={colors}
            />
            <Text style={[layout.mono, { color: colors.muted }]}>
              {f.anomaly_id}
            </Text>
          </View>
          <Text style={[layout.title, { color: colors.ink }]}>
            {humanize(f.anomaly_type)}
          </Text>
          <Text style={[layout.small, { color: colors.muted }]}>
            {assetName(f.asset_id)} · {f.location_id}
          </Text>
          <View style={layout.row}>
            <Text style={[layout.small, { color: colors.muted }]}>
              {shortTime(f.timestamp)}
            </Text>
            <Button
              label="Inspect →"
              accessibilityLabel={
                "Inspect " + humanize(f.anomaly_type) + " " + f.asset_id
              }
              colors={colors}
              onPress={() => onInspect(f)}
            />
          </View>
        </Card>
      ))}
    </>
  );
}
export function MissionHistory({
  colors,
  onInspect,
}: {
  colors: ThemeColors;
  onInspect: (mission: Mission) => void;
}) {
  return (
    <>
      <Text
        accessibilityRole="header"
        style={[layout.heading, { color: colors.ink }]}
      >
        Missions
      </Text>
      {dataset.missions
        .slice()
        .reverse()
        .map((m) => {
          const actions = missionActions(m.mission_id),
            passed = actions.filter((a) => a.status === "SUCCESS").length;
          return (
            <Card key={m.mission_id} colors={colors}>
              <View style={layout.row}>
                <Text style={[layout.mono, { color: colors.blue }]}>
                  {m.mission_id}
                </Text>
                <Badge
                  label={humanize(m.mission_status)}
                  severity={
                    m.mission_status === "COMPLETED" ? "SUCCESS" : "CRITICAL"
                  }
                  colors={colors}
                />
              </View>
              <Text style={[layout.title, { color: colors.ink }]}>
                Route {Number(m.mission_id.slice(1))}
              </Text>
              <View style={layout.row}>
                <Text style={[layout.small, { color: colors.muted }]}>
                  {shortTime(m.start_time)}
                </Text>
                <Text style={[layout.small, { color: colors.ink }]}>
                  {passed} / {actions.length} passed
                </Text>
              </View>
              {passed < actions.length && (
                <Badge
                  label={actions.length - passed + " failed"}
                  severity="MEDIUM"
                  colors={colors}
                />
              )}
              <Button
                label="Inspect →"
                accessibilityLabel={"Inspect " + m.mission_id}
                colors={colors}
                onPress={() => onInspect(m)}
              />
            </Card>
          );
        })}
    </>
  );
}
export function FacilityScreen({
  colors,
  waypoint,
  onSelect,
}: {
  colors: ThemeColors;
  waypoint: string;
  onSelect: (id: string) => void;
}) {
  const selected = dataset.locations.find((l) => l.location_id === waypoint)!;
  return (
    <>
      <Text
        accessibilityRole="header"
        style={[layout.heading, { color: colors.ink }]}
      >
        Facility
      </Text>
      <Image
        source={require("../assets/demo/facility.png")}
        accessibilityLabel="Illustrative fictional facility floor plan"
        style={{ width: "100%", aspectRatio: 1095 / 593, marginBottom: 12 }}
        resizeMode="contain"
      />
      <Card colors={colors}>
        <Text style={[layout.mono, { color: colors.blue }]}>{waypoint}</Text>
        <Text
          accessibilityRole="header"
          style={[layout.title, { color: colors.ink }]}
        >
          {selected.location_name}
        </Text>
        <Text style={[layout.small, { color: colors.muted }]}>
          Floor {selected.floor} · {humanize(selected.environment)}
        </Text>
      </Card>
      {dataset.locations.map((l) => (
        <Pressable
          key={l.location_id}
          accessibilityRole="button"
          accessibilityLabel={l.location_id + " " + l.location_name}
          accessibilityState={{ selected: l.location_id === waypoint }}
          onPress={() => onSelect(l.location_id)}
          style={{
            minHeight: 48,
            padding: 12,
            borderBottomWidth: 1,
            borderColor: colors.line,
            backgroundColor:
              l.location_id === waypoint ? colors.blueSoft : colors.surface,
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Text style={[layout.mono, { color: colors.blue }]}>
            {l.location_id}
          </Text>
          <Text style={[layout.small, { color: colors.ink, flex: 1 }]}>
            {l.location_name}
          </Text>
        </Pressable>
      ))}
    </>
  );
}
