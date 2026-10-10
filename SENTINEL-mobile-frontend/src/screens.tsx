import { Image, Pressable, Text, TextInput, View } from "react-native";
import {
  assetName,
  humanize,
  missionActions,
  pending,
  selectQueue,
  shortTime,
  type FindingStatus,
  type Mission,
  type ThemeColors,
} from "@sentinel/core";
import type { QueueItem } from "@sentinel/core/api";
import { useInspectionData } from "./state/api-data";
import { useQueue } from "./state/queue-data";
import { Badge, Button, Card, layout } from "./ui";

export function Attention({
  colors,
  query,
  setQuery,
  status,
  setStatus,
  reviewedIds,
  onInspect,
  onReview,
}: {
  colors: ThemeColors;
  query: string;
  setQuery: (value: string) => void;
  status: FindingStatus;
  setStatus: (value: FindingStatus) => void;
  reviewedIds: string[];
  onInspect: (item: QueueItem) => void;
  onReview: (id: string) => void;
}) {
  const data = useInspectionData();
  const queue = useQueue();
  const scenarios = new Map(data.missions.map((mission) => [mission.mission_id, mission.scenario]));
  const pendingItems = selectQueue(queue, { reviewedIds, scenarios });
  const items = selectQueue(queue, { query, status, reviewedIds, scenarios });
  const failures = pendingItems.filter((item) => item.verdict === "inspection_failure").length;
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
            {pendingItems.length}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>to review</Text>
        </View>
        <Badge
          colors={colors}
          severity="MEDIUM"
          label={failures + " inspection failures"}
        />
      </View>
      <TextInput
        accessibilityLabel="Search queue"
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
      {!items.length && (
        <Text
          accessibilityRole="text"
          style={{
            color: colors.muted,
            paddingVertical: 30,
            textAlign: "center",
          }}
        >
          No matching queue items
        </Text>
      )}
      {items.map((item) => (
        <Card
          key={item.id}
          colors={colors}
          style={{
            borderLeftWidth: 3,
            borderLeftColor:
              item.verdict === "inspection_failure" ? colors.amber : colors.blue,
          }}
        >
          <View style={layout.row}>
            <Badge
              label={
                reviewedIds.includes(item.id)
                  ? "Reviewed"
                  : humanize(item.verdict)
              }
              severity={reviewedIds.includes(item.id) ? "SUCCESS" : "MEDIUM"}
              colors={colors}
            />
            <Text style={[layout.mono, { color: colors.muted }]}>
              Rank {item.rank}
            </Text>
          </View>
          <Text style={[layout.title, { color: colors.ink }]}>
            {humanize(item.cause)}
          </Text>
          <Text style={[layout.small, { color: colors.muted }]}>
            {item.asset_id ? assetName(data, item.asset_id) : "Pending"} ·{" "}
            {pending(item.location_id)}
          </Text>
          <Text style={[layout.small, { color: colors.ink }]}>{item.explanation}</Text>
          <View style={layout.row}>
            <Button
              label={reviewedIds.includes(item.id) ? "Reviewed" : "Mark reviewed"}
              colors={colors}
              onPress={() => onReview(item.id)}
            />
            <Button
              label="Inspect →"
              accessibilityLabel={"Inspect " + humanize(item.cause) + " " + (item.asset_id || item.mission_id)}
              colors={colors}
              onPress={() => onInspect(item)}
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
  const data = useInspectionData();
  return (
    <>
      <Text
        accessibilityRole="header"
        style={[layout.heading, { color: colors.ink }]}
      >
        Missions
      </Text>
      {data.missions
        .slice()
        .reverse()
        .map((m) => {
          const actions = missionActions(data, m.mission_id),
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
  const data = useInspectionData();
  const selected = data.locations.find((l) => l.location_id === waypoint);
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
          {selected ? selected.location_name : "No locations"}
        </Text>
        <Text style={[layout.small, { color: colors.muted }]}>
          {selected
            ? "Floor " + selected.floor + " · " + humanize(selected.environment)
            : "No stored locations"}
        </Text>
      </Card>
      {data.locations.map((l) => (
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
