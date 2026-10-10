import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import {
  getMetrics,
  selectDailyMetrics,
  selectFindingSummary,
  type InspectionDataset,
  type ThemeColors,
} from "@sentinel/core";
import { Icon } from "../../design/icons";

const tones = {
  CRITICAL: "#d1484e",
  HIGH: "#f38a27",
  MEDIUM: "#ffd358",
  LOW: "#55bd85",
};
export function Sparkline({
  values,
  color,
  bars = false,
}: {
  values: number[];
  color: string;
  bars?: boolean;
}) {
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  const ys = values.map((n) => 30 - ((n - min) / (max - min || 1)) * 25);
  return (
    <Svg width={40} height={34} viewBox="0 0 40 34" accessible={false}>
      {bars ? (
        values.map((value, i) => (
          <Rect
            key={i}
            x={i * (40 / values.length)}
            y={ys[i]}
            width={Math.max(2, 40 / values.length - 2)}
            height={34 - ys[i]}
            fill={color}
            opacity={0.35 + (i / values.length) * 0.5}
          />
        ))
      ) : (
        <>
          <Path
            d={ys
              .map(
                (y, i) =>
                  `${i ? "L" : "M"}${(i * 38) / Math.max(1, ys.length - 1)} ${y}`,
              )
              .join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={1.2}
          />
          {ys.map((y, i) => (
            <Circle
              key={i}
              cx={(i * 38) / Math.max(1, ys.length - 1)}
              cy={y}
              r={1.3}
              fill={color}
            />
          ))}
        </>
      )}
    </Svg>
  );
}
function daily(
  data: InspectionDataset,
  kind: "runs" | "success" | "completion" | "duration",
) {
  return selectDailyMetrics(data).map((day) =>
    kind === "duration"
      ? day.averageDuration
      : kind === "runs"
        ? day.runs
        : kind === "completion"
          ? day.completion
          : day.actionSuccess,
  );
}
export function MetricBand({
  data,
  pending,
  critical,
  colors,
  scale,
  missions = false,
  period,
}: {
  data: InspectionDataset;
  pending: number;
  critical: number;
  colors: ThemeColors;
  scale: number;
  missions?: boolean;
  period?: string;
}) {
  const metrics = getMetrics(data, "ALL");
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const duration = data.missions.length
    ? Math.round(
        data.missions.reduce((sum, m) => sum + m.duration_min, 0) /
          data.missions.length,
      )
    : 0;
  const cards = [
    {
      title: missions ? "Total runs" : "To review",
      value: missions ? metrics.missionCount : pending,
      suffix: "",
      note: missions
        ? `${metrics.completedCount} completed`
        : `${critical} critical`,
      color: colors.blue,
      noteColor: missions ? colors.green : colors.amber,
      spark: daily(data, "runs"),
      bars: true,
      label: missions
        ? `${metrics.missionCount} runs, ${metrics.completedCount} completed`
        : `${pending} to review, ${critical} critical`,
    },
    {
      title: "Action success",
      value: metrics.actionSuccessRate,
      suffix: "%",
      note: `${metrics.successfulActionCount} / ${metrics.actionCount} passed`,
      color: colors.ink,
      noteColor: colors.muted,
      spark: daily(data, "success"),
      bars: false,
      label: `Action success: ${metrics.actionSuccessRate}%, ${metrics.successfulActionCount} of ${metrics.actionCount} passed`,
    },
    {
      title: missions ? "Avg. duration" : "Completion",
      value: missions ? duration : metrics.completionRate,
      suffix: missions ? " min" : "%",
      note: missions
        ? period || "All dates"
        : `${metrics.completedCount} / ${metrics.missionCount}`,
      color: colors.ink,
      noteColor: colors.muted,
      spark: daily(data, missions ? "duration" : "completion"),
      bars: true,
      label: missions
        ? `Average duration: ${duration} minutes`
        : `Mission completion: ${metrics.completionRate}%, ${metrics.completedCount} of ${metrics.missionCount} completed`,
    },
  ];
  return (
    <View
      style={{
        flexDirection: stacked ? "column" : "row",
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 4,
        marginBottom: 10 * scale,
        overflow: "hidden",
      }}
    >
      {cards.map((card, i) => (
        <View
          key={card.title}
          accessible
          accessibilityLabel={card.label}
          style={{
            flex: 1,
            paddingHorizontal: 12 * scale,
            paddingVertical: 9 * scale,
            borderRightWidth: !stacked && i < 2 ? 1 : 0,
            borderBottomWidth: stacked && i < 2 ? 1 : 0,
            borderColor: colors.line,
            minHeight: 86 * scale,
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 10 * scale, color: colors.muted }}>
            {card.title}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              marginTop: 5,
            }}
          >
            <Text
              style={{
                fontSize: (i ? 26 : 30) * scale,
                fontWeight: "700",
                letterSpacing: -1,
                color: card.color,
              }}
            >
              {card.value}
              <Text style={{ fontSize: 13 * scale, letterSpacing: 0 }}>
                {card.suffix}
              </Text>
            </Text>
          </View>
          <Text
            style={{
              fontSize: 10 * scale,
              color: card.noteColor,
              marginTop: 3,
            }}
          >
            {card.note}
          </Text>
          <View
            style={{
              position: "absolute",
              right: 7,
              top: 32 * scale,
              opacity: 0.85,
            }}
            pointerEvents="none"
          >
            <Sparkline
              values={card.spark}
              color={i === 2 ? (missions ? "#b1bed2" : "#59b98b") : "#77bafa"}
              bars={card.bars}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
const typeGroups = [
  {
    label: "Visual",
    icon: "camera" as const,
    types: ["VISUAL_DEFECT", "GAUGE_OUT_OF_RANGE"],
  },
  {
    label: "Thermal",
    icon: "temperature" as const,
    types: ["ABNORMAL_TEMPERATURE"],
  },
  {
    label: "Navigation",
    icon: "navigation" as const,
    types: ["NAVIGATION_OBSTRUCTION", "LOCALIZATION_ISSUE"],
  },
  {
    label: "Signal",
    icon: "signal" as const,
    types: ["SIGNAL_DEGRADATION", "ABNORMAL_VIBRATION"],
  },
];
export function SummaryCharts({
  data,
  colors,
  scale,
  stacked,
  onSeverity,
  onTypes,
}: {
  data: InspectionDataset;
  colors: ThemeColors;
  scale: number;
  stacked: boolean;
  onSeverity: (value: string) => void;
  onTypes: (types: string[], name: string) => void;
}) {
  const summary = selectFindingSummary(data);
  const total = summary.total;
  const donutSize = 81 * scale * (stacked ? 1.6 : 1);
  let offset = 0;
  const sectors = Object.entries(tones).map(([severity, color]) => {
    const count = summary.severities.find(
      (s) => s.severity === severity,
    )!.count;
    const length = total ? (count / total) * 251.3 : 0;
    const value = { severity, color, count, length, offset };
    offset += length;
    return value;
  });
  return (
    <View
      style={{
        flexDirection: stacked ? "column" : "row",
        gap: 10 * scale,
        marginBottom: 12 * scale,
      }}
    >
      <View
        style={{
          flex: 1,
          padding: 11 * scale,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 4,
        }}
      >
        <Text
          style={{
            color: colors.ink,
            fontWeight: "600",
            fontSize: 10.5 * scale,
            marginBottom: 10 * scale,
          }}
        >
          Findings by severity ›
        </Text>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 9 * scale }}
        >
          <View
            style={{
              width: donutSize,
              height: donutSize,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg width={donutSize} height={donutSize} viewBox="0 0 100 100">
              <Circle
                cx={50}
                cy={50}
                r={40}
                stroke={colors.raised}
                strokeWidth={13}
                fill="none"
              />
              {sectors.map((sector) => (
                <Circle
                  key={sector.severity}
                  accessible
                  accessibilityLabel={`${sector.severity.charAt(0) + sector.severity.slice(1).toLowerCase()} chart segment`}
                  onPress={() => onSeverity(sector.severity)}
                  cx={50}
                  cy={50}
                  r={40}
                  stroke={sector.color}
                  strokeWidth={13}
                  fill="none"
                  strokeDasharray={`${Math.max(0, sector.length - 0.8)} ${251.3 - Math.max(0, sector.length - 0.8)}`}
                  strokeDashoffset={-sector.offset}
                  rotation={-90}
                  origin="50,50"
                />
              ))}
            </Svg>
            <View
              accessible
              accessibilityLabel={`${total} total findings`}
              pointerEvents="none"
              style={{ position: "absolute", alignItems: "center" }}
            >
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 20 * scale,
                  fontWeight: "700",
                }}
              >
                {total}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 9 * scale }}>
                findings
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            {sectors.map((sector) => (
              <Pressable
                key={sector.severity}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${sector.severity.charAt(0) + sector.severity.slice(1).toLowerCase()} findings`}
                onPress={() => onSeverity(sector.severity)}
                hitSlop={8}
                style={{
                  minHeight: 23 * scale,
                  flexDirection: "row",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: sector.color,
                  }}
                />
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 9.5 * scale,
                    flex: 1,
                  }}
                >
                  {sector.severity.charAt(0) +
                    sector.severity.slice(1).toLowerCase()}
                </Text>
                <Text style={{ color: colors.ink, fontSize: 10 * scale }}>
                  {sector.count}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View
        style={{
          flex: 1,
          padding: 11 * scale,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 4,
        }}
      >
        <Text
          style={{
            color: colors.ink,
            fontWeight: "600",
            fontSize: 10.5 * scale,
            marginBottom: 10 * scale,
          }}
        >
          Findings by type
        </Text>
        {typeGroups.map((group) => {
          const percent = summary.types.find(
            (t) => t.label === group.label,
          )!.share;
          return (
            <Pressable
              key={group.label}
              accessibilityRole="button"
              accessibilityLabel={`Filter ${group.label} findings`}
              onPress={() => onTypes(group.types, group.label)}
              hitSlop={8}
              style={{
                minHeight: 23 * scale,
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
              }}
            >
              <Icon name={group.icon} color={colors.ink} size={12 * scale} />
              <Text
                style={{
                  fontSize: 8.5 * scale,
                  color: colors.muted,
                  width: (stacked ? 110 : 46) * scale,
                }}
              >
                {group.label}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: colors.raised,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${percent}%`,
                    height: "100%",
                    backgroundColor: "#acd4fd",
                  }}
                />
              </View>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 9 * scale,
                  width: (stacked ? 54 : 27) * scale,
                  textAlign: "right",
                }}
              >
                {Number(percent.toFixed(1))}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
