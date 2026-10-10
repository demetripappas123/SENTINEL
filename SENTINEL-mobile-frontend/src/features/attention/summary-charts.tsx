import { useId, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import {
  getMetrics,
  selectDailyMetrics,
  selectFindingSummary,
  type InspectionDataset,
} from "@sentinel/core";
import { Icon, type IconName } from "../../design/icons";
import {
  fonts,
  radii,
  severityColor,
  typography,
  type Theme,
} from "../../design/tokens";
import { Card, Panel } from "../../ui";

const SPARK_HEIGHT = 26;

/** Daily trend under each metric, drawn like the web's performance chart. */
export function Sparkline({
  values,
  color,
  bars = false,
}: {
  values: number[];
  color: string;
  bars?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const gradient = useId();
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  const y = (n: number) =>
    SPARK_HEIGHT - 2 - ((n - min) / (max - min || 1)) * (SPARK_HEIGHT - 6);
  const x = (i: number) =>
    values.length > 1 ? 1 + (i * (width - 2)) / (values.length - 1) : width / 2;
  const line = values
    .map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(n).toFixed(1)}`)
    .join(" ");
  const step = values.length ? width / values.length : 0;
  return (
    <View
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={{ height: SPARK_HEIGHT, marginTop: 10 }}
      pointerEvents="none"
    >
      {width > 0 && values.length > 0 && (
        <Svg width={width} height={SPARK_HEIGHT} accessible={false}>
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {bars ? (
            values.map((value, i) => (
              <Rect
                key={i}
                x={i * step + 1}
                y={y(value)}
                width={Math.max(2, step - 3)}
                height={SPARK_HEIGHT - y(value)}
                rx={1.5}
                fill={color}
                opacity={0.3 + (i / values.length) * 0.6}
              />
            ))
          ) : (
            <>
              {values.length > 1 && (
                <Path
                  d={`${line} L${x(values.length - 1)} ${SPARK_HEIGHT} L${x(0)} ${SPARK_HEIGHT} Z`}
                  fill={`url(#${gradient})`}
                />
              )}
              <Path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth={1.75}
                strokeLinejoin="round"
              />
            </>
          )}
        </Svg>
      )}
    </View>
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
type Tone = "good" | "mid" | "bad" | "neutral";
// Same thresholds as the web Overview's metric cards.
const rateTone = (rate: number): Tone =>
  rate >= 80 ? "good" : rate >= 50 ? "mid" : "bad";

export function MetricBand({
  data,
  pending,
  critical,
  colors,
  missions = false,
  period,
}: {
  data: InspectionDataset;
  pending: number;
  critical: number;
  colors: Theme;
  missions?: boolean;
  period?: string;
}) {
  const metrics = getMetrics(data, "ALL");
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const duration = data.missions.length
    ? Math.round(
        data.missions.reduce((sum, m) => sum + (m.duration_min ?? 0), 0) /
          data.missions.length,
      )
    : 0;
  const successTone = metrics.actionCount
    ? rateTone(metrics.actionSuccessRate)
    : "neutral";
  const cards: {
    title: string;
    value: number;
    suffix: string;
    note: string;
    icon: IconName;
    tone: Tone;
    spark: number[];
    bars: boolean;
    label: string;
  }[] = [
    {
      title: missions ? "Total runs" : "To review",
      value: missions ? metrics.missionCount : pending,
      suffix: "",
      note: missions
        ? `${metrics.completedCount} completed`
        : `${critical} critical`,
      icon: missions ? "missions" : "attention",
      tone: missions
        ? "neutral"
        : critical > 0
          ? "bad"
          : pending > 0
            ? "mid"
            : "good",
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
      icon: "activity",
      tone: successTone,
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
      icon: missions ? "calendar" : "checks",
      tone:
        missions || !metrics.missionCount
          ? "neutral"
          : rateTone(metrics.completionRate),
      spark: daily(data, missions ? "duration" : "completion"),
      bars: true,
      label: missions
        ? `Average duration: ${duration} minutes`
        : `Mission completion: ${metrics.completionRate}%, ${metrics.completedCount} of ${metrics.missionCount} completed`,
    },
  ];
  const toneColor = (tone: Tone) =>
    tone === "neutral" ? colors.brand : colors[tone];
  return (
    <View
      style={{
        flexDirection: stacked ? "column" : "row",
        gap: 8,
        marginBottom: 12,
      }}
    >
      {cards.map((card) => (
        <Card
          key={card.title}
          colors={colors}
          style={{ flex: stacked ? undefined : 1, padding: 12 }}
        >
          <View accessible accessibilityLabel={card.label}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  fontSize: 11,
                  color: colors.mutedForeground,
                  flexShrink: 1,
                }}
              >
                {card.title}
              </Text>
              <Icon name={card.icon} color={toneColor(card.tone)} size={14} />
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                typography.metric,
                { color: colors.foreground, marginTop: 6 },
              ]}
            >
              {card.value}
              <Text
                style={{
                  fontSize: 14,
                  letterSpacing: 0,
                  color: colors.mutedForeground,
                }}
              >
                {card.suffix}
              </Text>
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                marginTop: 2,
                color:
                  card.tone === "neutral"
                    ? colors.mutedForeground
                    : colors[card.tone],
              }}
            >
              {card.note}
            </Text>
            <Sparkline
              values={card.spark}
              color={colors.chartAccent}
              bars={card.bars}
            />
          </View>
        </Card>
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
const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const CIRCUMFERENCE = 2 * Math.PI * 40;
const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();

export function SummaryCharts({
  data,
  colors,
  stacked,
  onSeverity,
  onTypes,
}: {
  data: InspectionDataset;
  colors: Theme;
  stacked: boolean;
  onSeverity: (value: string) => void;
  onTypes: (types: string[], name: string) => void;
}) {
  const summary = selectFindingSummary(data);
  const total = summary.total;
  const donutSize = stacked ? 150 : 112;
  let offset = 0;
  const sectors = severities.map((severity) => {
    const count =
      summary.severities.find((s) => s.severity === severity)?.count ?? 0;
    const length = total ? (count / total) * CIRCUMFERENCE : 0;
    const value = {
      severity,
      color: severityColor(colors, severity),
      count,
      length,
      offset,
    };
    offset += length;
    return value;
  });
  const hint = (
    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
      Tap to filter
    </Text>
  );
  return (
    <>
      <Panel title="Findings by severity" action={hint} colors={colors}>
        <View
          style={{
            flexDirection: stacked ? "column" : "row",
            alignItems: stacked ? "flex-start" : "center",
            gap: 20,
            padding: 16,
          }}
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
                stroke={colors.muted}
                strokeWidth={11}
                fill="none"
              />
              {sectors.map((sector) => (
                <Circle
                  key={sector.severity}
                  accessible
                  accessibilityLabel={`${titleCase(sector.severity)} chart segment`}
                  onPress={() => onSeverity(sector.severity)}
                  cx={50}
                  cy={50}
                  r={40}
                  stroke={sector.color}
                  strokeWidth={11}
                  fill="none"
                  strokeDasharray={`${Math.max(0, sector.length - 1.2)} ${CIRCUMFERENCE - Math.max(0, sector.length - 1.2)}`}
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
                  color: colors.foreground,
                  fontSize: stacked ? 30 : 26,
                  fontWeight: "600",
                  letterSpacing: -0.8,
                }}
              >
                {total}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                findings
              </Text>
            </View>
          </View>
          <View style={{ flex: stacked ? undefined : 1, alignSelf: "stretch" }}>
            {sectors.map((sector) => (
              <Pressable
                key={sector.severity}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${titleCase(sector.severity)} findings`}
                onPress={() => onSeverity(sector.severity)}
                style={({ pressed }) => ({
                  minHeight: 30,
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                  paddingHorizontal: 8,
                  borderRadius: radii.md,
                  backgroundColor: pressed ? colors.muted : "transparent",
                })}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: sector.color,
                  }}
                />
                <Text
                  style={{ color: colors.foreground, fontSize: 12, flex: 1 }}
                >
                  {titleCase(sector.severity)}
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 12,
                    fontFamily: fonts.mono,
                  }}
                >
                  {sector.count}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 11,
                    width: 34,
                    textAlign: "right",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {total ? Math.round((sector.count / total) * 100) : 0}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Panel>
      <Panel title="Findings by type" action={hint} colors={colors}>
        <View style={{ padding: 8, paddingVertical: 10 }}>
          {typeGroups.map((group) => {
            const percent =
              summary.types.find((t) => t.label === group.label)?.share ?? 0;
            return (
              <Pressable
                key={group.label}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${group.label} findings`}
                onPress={() => onTypes(group.types, group.label)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                  paddingHorizontal: 8,
                  borderRadius: radii.md,
                  backgroundColor: pressed ? colors.muted : "transparent",
                })}
              >
                <Icon
                  name={group.icon}
                  color={colors.mutedForeground}
                  size={14}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.foreground,
                    width: stacked ? 120 : 72,
                  }}
                >
                  {group.label}
                </Text>
                {/* Web `.reliability-row .bar`: secondary track, primary fill. */}
                <View
                  style={{
                    flex: 1,
                    height: 8,
                    backgroundColor: colors.secondary,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${percent}%`,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 11,
                    fontFamily: fonts.mono,
                    width: stacked ? 64 : 44,
                    textAlign: "right",
                  }}
                >
                  {Number(percent.toFixed(1))}%
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Panel>
    </>
  );
}
