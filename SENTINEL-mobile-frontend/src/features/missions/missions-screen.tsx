import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  humanize,
  selectMissionActions,
  type Configuration,
  type ThemeColors,
} from "@sentinel/core";
import { Badge, SegmentedControl } from "../../ui";
import { Icon } from "../../design/icons";
import {
  ScreenHeading,
  displayDateRange,
  displayTime,
  useScreenData,
} from "../shared";
import { MetricBand } from "../attention/summary-charts";

export function MissionsScreen({
  colors,
  onInspect,
  onlyCompletedWithFailures,
  onClearFailureFilter,
}: {
  colors: ThemeColors;
  onInspect: (id: string) => void;
  onlyCompletedWithFailures: boolean;
  onClearFailureFilter: () => void;
}) {
  const { data, scale } = useScreenData();
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const missions = data.missions.filter(
    (m) => configuration === "ALL" || m.scenario === configuration,
  );
  const ids = new Set(missions.map((m) => m.mission_id));
  const scoped = {
    ...data,
    missions,
    actions: data.actions.filter((a) => ids.has(a.mission_id)),
  };
  const visible = missions
    .filter(
      (m) =>
        !onlyCompletedWithFailures ||
        (m.mission_status === "COMPLETED" &&
          selectMissionActions(data, m.mission_id).some(
            (a) => a.status === "FAILED",
          )),
    )
    .slice()
    .sort((a, b) => b.start_time.localeCompare(a.start_time));
  const days = missions.map((m) => m.start_time.slice(0, 10)).sort();
  return (
    <>
      <ScreenHeading
        title="Missions"
        subtitle={`${missions.length} runs  ·  ${missions.filter((m) => m.mission_status === "COMPLETED").length} completed`}
        colors={colors}
        scale={scale}
      />
      <MetricBand
        data={scoped}
        pending={0}
        critical={0}
        colors={colors}
        scale={scale}
        missions
        period={displayDateRange(days[0] || "", days.at(-1) || "")}
      />
      <View style={{ marginTop: 4 * scale, marginBottom: 12 * scale }}>
        <SegmentedControl
          options={[
            { value: "ALL", label: "All" },
            { value: "BASELINE", label: "Baseline" },
            { value: "IMPROVED", label: "Improved" },
          ]}
          value={configuration}
          colors={colors}
          onChange={setConfiguration}
        />
      </View>
      {onlyCompletedWithFailures && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear completed missions filter"
          onPress={onClearFailureFilter}
          style={{
            padding: 10,
            marginBottom: 12,
            borderRadius: 4,
            backgroundColor: colors.amberSoft,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.amber }}>
            Completed with failed actions ×
          </Text>
        </Pressable>
      )}
      {!visible.length && (
        <Text style={{ color: colors.muted, padding: 24 }}>
          No matching missions
        </Text>
      )}
      {visible.map((m) => {
        const actions = selectMissionActions(data, m.mission_id),
          passed = actions.filter((a) => a.status === "SUCCESS").length,
          failed = actions.filter((a) => a.status === "FAILED").length;
        return (
          <Pressable
            key={m.mission_id}
            accessibilityRole="button"
            accessibilityLabel={`Inspect ${m.mission_id}`}
            onPress={() => onInspect(m.mission_id)}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 7,
              backgroundColor: pressed ? colors.raised : colors.surface,
              padding: 12 * scale,
              marginBottom: 11 * scale,
              gap: 5 * scale,
            })}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  backgroundColor: colors.raised,
                  borderRadius: 3,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 10 * scale, color: colors.ink }}>
                  {m.mission_id}
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <Badge
                label={humanize(m.mission_status)}
                severity={
                  m.mission_status === "COMPLETED"
                    ? "SUCCESS"
                    : m.mission_status === "FAILED"
                      ? "CRITICAL"
                      : "MEDIUM"
                }
                colors={colors}
              />
              <Icon name="chevron" color={colors.muted} size={14} />
            </View>
            <Text
              style={{
                fontSize: 16 * scale,
                fontWeight: "700",
                letterSpacing: -0.4,
                color: colors.ink,
              }}
            >
              {/^M\d+$/.test(m.mission_id)
                ? `Route ${Number(m.mission_id.slice(1))}`
                : m.mission_name || m.mission_id}
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 5 * scale,
              }}
            >
              <Text style={{ fontSize: 11 * scale, color: colors.muted }}>
                {displayTime(m.start_time)} · {m.duration_min} min
              </Text>
              <Text style={{ fontSize: 11 * scale, color: colors.ink }}>
                {passed} / {actions.length} passed
              </Text>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${m.mission_id} successful actions`}
              accessibilityValue={{
                min: 0,
                max: actions.length || 1,
                now: passed,
                text: actions.length
                  ? `${passed} of ${actions.length} passed`
                  : "No actions recorded",
              }}
              style={{
                height: 8 * scale,
                backgroundColor: colors.line,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${actions.length ? (passed / actions.length) * 100 : 0}%`,
                  backgroundColor: "#2376c4",
                }}
              />
            </View>
            {failed > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 4 * scale,
                }}
              >
                <Badge
                  label={`${failed} failed`}
                  severity="HIGH"
                  colors={colors}
                />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={{ fontSize: 11 * scale, color: colors.blue }}>
                    Inspect
                  </Text>
                  <Icon name="arrow" color={colors.blue} size={14} />
                </View>
              </View>
            )}
            {!actions.length && (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                No actions recorded.
              </Text>
            )}
          </Pressable>
        );
      })}
    </>
  );
}
