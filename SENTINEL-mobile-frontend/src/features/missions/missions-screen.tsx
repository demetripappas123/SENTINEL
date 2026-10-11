import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  configurationLabel,
  humanize,
  selectMissionActions,
  type Configuration,
} from "@sentinel/core";
import {
  Badge,
  FilterChip,
  Panel,
  SegmentedControl,
  statusTone,
} from "../../ui";
import { Icon } from "../../design/icons";
import { fonts, type Theme } from "../../design/tokens";
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
  colors: Theme;
  onInspect: (id: string) => void;
  onlyCompletedWithFailures: boolean;
  onClearFailureFilter: () => void;
}) {
  const { data } = useScreenData();
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const missions = data.missions.filter(
    (m) => configuration === "ALL" || m.configuration_version === configuration,
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
    .sort((a, b) => (b.start_time ?? "").localeCompare(a.start_time ?? ""));
  const days = missions
    .map((m) => (m.start_time ?? "").slice(0, 10))
    .filter(Boolean)
    .sort();
  return (
    <>
      <ScreenHeading
        title="Missions"
        subtitle={`${missions.length} runs · ${missions.filter((m) => m.mission_status === "COMPLETED").length} completed`}
        colors={colors}
      />
      <View style={{ marginBottom: 12 }}>
        <SegmentedControl
          options={[
            { value: "ALL", label: "All" },
            { value: "V1", label: configurationLabel("V1") ?? "V1" },
            { value: "V2", label: configurationLabel("V2") ?? "V2" },
          ]}
          value={configuration}
          colors={colors}
          onChange={setConfiguration}
        />
      </View>
      <MetricBand
        data={scoped}
        pending={0}
        critical={0}
        colors={colors}
        missions
        period={displayDateRange(days[0] || "", days.at(-1) || "")}
      />
      {onlyCompletedWithFailures && (
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <FilterChip
            label="Completed with failed actions"
            accessibilityLabel="Clear completed missions filter"
            colors={colors}
            onPress={onClearFailureFilter}
          />
        </View>
      )}
      <Panel
        title="Runs"
        icon="missions"
        action={
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
            Newest first
          </Text>
        }
        colors={colors}
      >
        {!visible.length && (
          <Text
            style={{
              color: colors.mutedForeground,
              padding: 24,
              textAlign: "center",
              fontSize: 13,
            }}
          >
            No matching missions
          </Text>
        )}
        {visible.map((m, index) => {
          const actions = selectMissionActions(data, m.mission_id),
            passed = actions.filter((a) => a.status === "SUCCESS").length,
            failed = actions.filter((a) => a.status === "FAILED").length,
            awaiting = actions.length - passed - failed;
          return (
            <Pressable
              key={m.mission_id}
              accessibilityRole="button"
              accessibilityLabel={`Inspect ${m.mission_id}`}
              onPress={() => onInspect(m.mission_id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 16,
                paddingVertical: 13,
                borderTopWidth: index ? 1 : 0,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.secondary : colors.card,
              })}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    {/^M\d+$/.test(m.mission_id)
                      ? `Route ${Number(m.mission_id.slice(1))}`
                      : m.mission_name || m.mission_id}
                  </Text>
                  <Badge
                    label={humanize(m.mission_status)}
                    tone={statusTone(m.mission_status)}
                    colors={colors}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 11, color: colors.mutedForeground }}
                >
                  <Text style={{ fontFamily: fonts.mono }}>{m.mission_id}</Text>
                  {"  ·  "}
                  {displayTime(m.start_time)} · {m.duration_min ?? "—"} min
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: fonts.mono,
                      color: colors.foreground,
                      minWidth: 38,
                    }}
                  >
                    {passed}/{actions.length}
                  </Text>
                  {/* Web `.mini-progress`: one tick per action, by outcome. */}
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
                      flex: 1,
                      flexDirection: "row",
                      gap: 2,
                      height: 4,
                    }}
                  >
                    {actions.length ? (
                      actions.map((a) => (
                        <View
                          key={a.action_id}
                          style={{
                            flex: 1,
                            maxWidth: 14,
                            borderRadius: 1,
                            backgroundColor:
                              a.status === "FAILED"
                                ? colors.destructive
                                : a.status === "SUCCESS"
                                  ? colors.primary
                                  : colors.border,
                          }}
                        />
                      ))
                    ) : (
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 1,
                          backgroundColor: colors.border,
                        }}
                      />
                    )}
                  </View>
                </View>
                {!actions.length ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                    No actions recorded.
                  </Text>
                ) : failed > 0 ? (
                  <Badge
                    label={`${failed} failed`}
                    tone="secondary"
                    colors={colors}
                  />
                ) : awaiting > 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                    {awaiting} awaiting outcome
                  </Text>
                ) : null}
              </View>
              <Icon name="chevron" color={colors.mutedForeground} size={15} />
            </Pressable>
          );
        })}
      </Panel>
    </>
  );
}
