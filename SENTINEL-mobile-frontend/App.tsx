import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  missionActions,
  palette,
  type Action,
  type Finding,
  type FindingStatus,
  type Mission,
} from "@sentinel/core";
import { Attention, FacilityScreen, MissionHistory } from "./src/screens";
import { InspectionDataProvider, useInspectionData } from "./src/state/api-data";
import { QueueProvider } from "./src/state/queue-data";
import { EvidenceSheet } from "./src/evidence-sheet";
import { Badge, Button, layout } from "./src/ui";

export default function App() {
  return (
    <InspectionDataProvider>
      <QueueProvider>
        <AppScreen />
      </QueueProvider>
    </InspectionDataProvider>
  );
}

function AppScreen() {
  const data = useInspectionData();
  const [tab, setTab] = useState<"attention" | "missions" | "facility">(
    "attention",
  );
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState<FindingStatus>("required");
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [waypoint, setWaypoint] = useState("WP05");
  const [finding, setFinding] = useState<Finding | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const colors = palette[theme],
    overlayOpen = !!finding || !!mission;
  const close = () => {
    setFinding(null);
    setMission(null);
    setAction(null);
  };
  return (
    <SafeAreaProvider
      initialMetrics={
        initialWindowMetrics || {
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }
      }
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <StatusBar style={theme === "light" ? "dark" : "light"} />
        <View
          style={{ flex: 1 }}
          accessibilityElementsHidden={overlayOpen}
          importantForAccessibility={
            overlayOpen ? "no-hide-descendants" : "auto"
          }
        >
          <View
            style={[
              layout.row,
              {
                minHeight: 56,
                paddingHorizontal: 20,
                borderBottomWidth: 1,
                borderColor: colors.line,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                letterSpacing: 2,
                color: colors.ink,
              }}
            >
              SENTINEL
            </Text>
            <Badge label="Synthetic" severity="LOW" colors={colors} />
            <Button
              label={theme === "light" ? "Dark" : "Light"}
              accessibilityLabel="Toggle theme"
              colors={colors}
              onPress={() => setTheme(theme === "light" ? "dark" : "light")}
            />
          </View>
          <ScrollView
            style={{ flex: 1, backgroundColor: colors.background }}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {tab === "attention" ? (
              <Attention
                colors={colors}
                query={query}
                setQuery={setQuery}
                status={status}
                setStatus={setStatus}
                reviewedIds={reviewedIds}
                onInspect={(item) => {
                  const linked = data.findings.find((finding) => finding.action_id === item.action_id);
                  const linkedAction = data.actions.find((row) => row.action_id === item.action_id);
                  setFinding(linked ?? null);
                  setAction(linkedAction ?? null);
                  setMission(
                    data.missions.find((row) => row.mission_id === item.mission_id) ?? null,
                  );
                }}
                onReview={(id) => setReviewedIds((ids) => [...new Set([...ids, id])])}
              />
            ) : tab === "missions" ? (
              <MissionHistory
                colors={colors}
                onInspect={(m) => {
                  setMission(m);
                  const actions = missionActions(data, m.mission_id);
                  setAction(
                    actions.find((a) => a.status === "FAILED") || actions[0],
                  );
                }}
              />
            ) : (
              <FacilityScreen
                colors={colors}
                waypoint={waypoint}
                onSelect={setWaypoint}
              />
            )}
          </ScrollView>
          <View
            style={[
              layout.row,
              { padding: 8, borderTopWidth: 1, borderColor: colors.line },
            ]}
          >
            {(
              [
                ["attention", "Attention"],
                ["missions", "Missions"],
                ["facility", "Facility"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                label={label}
                selected={tab === value}
                colors={colors}
                onPress={() => {
                  setTab(value);
                  setQuery("");
                }}
              />
            ))}
          </View>
        </View>
        <EvidenceSheet
          finding={finding}
          mission={mission}
          action={action}
          reviewed={!!finding && reviewedIds.includes(finding.anomaly_id)}
          colors={colors}
          onClose={close}
          onAction={setAction}
          onReview={(id) =>
            setReviewedIds((previous) => [...new Set([...previous, id])])
          }
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
