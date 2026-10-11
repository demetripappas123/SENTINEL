import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getFindings,
  getMetrics,
  humanize,
  type FindingStatus,
} from "@sentinel/core";
import {
  Badge,
  FilterChip,
  Panel,
  SegmentedControl,
  severityTone,
} from "../../ui";
import { Icon } from "../../design/icons";
import { fonts, radii, type Theme } from "../../design/tokens";
import { findingThumbnail } from "../../assets";
import { useReducedMotion } from "../../design/motion";
import {
  ScreenHeading,
  displayDateRange,
  displayTime,
  useScreenData,
} from "../shared";
import { MetricBand, SummaryCharts } from "./summary-charts";
import { DateRangeSheet } from "./date-range-sheet";
import { FiltersSheet } from "./filters-sheet";

// Native chrome around a scrolled-into-view queue panel: app header, tab bar,
// panel header and footer, and breathing room above and below.
const QUEUE_CHROME = 52 + 58 + 46 + 52 + 32;

export function AttentionScreen({
  colors,
  onInspect,
  onShowFailedMissions,
}: {
  colors: Theme;
  onInspect: (id: string) => void;
  onShowFailedMissions: () => void;
}) {
  const { data, range, setRange, reviewedIds, largeText } = useScreenData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FindingStatus>("required");
  const [severity, setSeverity] = useState<string | null>(null);
  const [types, setTypes] = useState<string[]>([]),
    [typeLabel, setTypeLabel] = useState("");
  const [datesOpen, setDatesOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Once scrolled into view, the queue panel fills the screen and scrolls
  // its rows; large text keeps a fixed height and lets the page scroll.
  const listHeight = largeText
    ? 340
    : Math.max(220, height - insets.top - insets.bottom - QUEUE_CHROME);
  const pending = getFindings(data, { reviewedIds });
  const critical = pending.filter((f) => f.severity === "CRITICAL").length;
  const findings = getFindings(data, { query, status, reviewedIds }).filter(
    (f) =>
      (!severity || f.severity === severity) &&
      (!types.length || types.includes(f.anomaly_type)),
  );
  const queue = findings.filter(
    (f) => f.operator_review_required && !reviewedIds.includes(f.anomaly_id),
  );
  const visible = findings;
  const reducedMotion = useReducedMotion();
  const listOpacity = useRef(new Animated.Value(1)).current;
  const resultIds = visible.map((finding) => finding.anomaly_id).join(",");
  useEffect(() => {
    if (reducedMotion) {
      listOpacity.setValue(1);
      return;
    }
    listOpacity.setValue(0.75);
    const transition = Animated.timing(listOpacity, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [resultIds, reducedMotion, listOpacity]);
  const days = data.missions
    .map((m) => (m.start_time ?? "").slice(0, 10))
    .filter(Boolean)
    .sort();
  const start = range?.start || days[0] || "",
    end = range?.end || days.at(-1) || "";
  const metrics = getMetrics(data, "ALL");
  const filtered = !!severity || types.length > 0;
  return (
    <>
      <ScreenHeading
        title="Attention"
        subtitle="Findings and inspection health"
        colors={colors}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose mission dates"
            onPress={() => setDatesOpen(true)}
            hitSlop={6}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              minHeight: 34,
              borderWidth: 1,
              borderColor: colors.input,
              borderRadius: radii.md,
              backgroundColor: pressed ? colors.muted : colors.background,
            })}
          >
            <Icon name="calendar" size={14} color={colors.mutedForeground} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "500",
                color: colors.foreground,
              }}
            >
              {displayDateRange(start, end)}
            </Text>
            <Icon name="down" size={13} color={colors.mutedForeground} />
          </Pressable>
        }
      />
      <MetricBand
        data={data}
        pending={pending.length}
        critical={critical}
        colors={colors}
      />
      {metrics.completedWithFailures > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Inspect completed missions with failed actions"
          onPress={onShowFailedMissions}
          style={({ pressed }) => ({
            minHeight: 44,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.muted : colors.card,
            borderRadius: radii.xl,
            paddingHorizontal: 12,
            paddingVertical: 9,
            gap: 9,
          })}
        >
          <Icon name="attention" color={colors.foreground} size={16} />
          <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>
              {metrics.completedWithFailures} completed{" "}
              {metrics.completedWithFailures === 1 ? "mission" : "missions"}
            </Text>{" "}
            {metrics.completedWithFailures === 1 ? "has" : "have"} failed
            actions
          </Text>
          <Text
            style={{ color: colors.primary, fontSize: 12, fontWeight: "500" }}
          >
            Inspect
          </Text>
          <Icon name="external" color={colors.primary} size={14} />
        </Pressable>
      )}
      <SummaryCharts
        data={data}
        colors={colors}
        stacked={largeText}
        onSeverity={setSeverity}
        onTypes={(values, label) => {
          setTypes(values);
          setTypeLabel(label);
        }}
      />
      {/* Web `.queue-toolbar`: search plus status and filter controls. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.input,
          borderRadius: radii.md,
          paddingHorizontal: 10,
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Icon name="search" color={colors.mutedForeground} size={16} />
        <TextInput
          accessibilityLabel="Search findings"
          placeholder="Search asset or waypoint"
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            color: colors.foreground,
            fontSize: 14,
            flex: 1,
            minHeight: 40,
            paddingVertical: 8,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: filtered ? 8 : 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <SegmentedControl
            options={[
              { value: "required", label: "To review" },
              { value: "all", label: "All" },
              { value: "reviewed", label: "Reviewed" },
            ]}
            value={status}
            colors={colors}
            onChange={setStatus}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finding filters"
          onPress={() => setFiltersOpen(true)}
          hitSlop={4}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderWidth: 1,
            borderColor: filtered ? colors.brand : colors.input,
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.muted : colors.background,
          })}
        >
          <Icon
            name="filters"
            size={17}
            color={filtered ? colors.brand : colors.foreground}
          />
        </Pressable>
      </View>
      {filtered && (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {severity && (
            <FilterChip
              label={humanize(severity)}
              accessibilityLabel={`Clear ${humanize(severity)} filter`}
              colors={colors}
              onPress={() => setSeverity(null)}
            />
          )}
          {!!types.length && (
            <FilterChip
              label={typeLabel || "Type filter"}
              accessibilityLabel="Clear type filter"
              colors={colors}
              onPress={() => setTypes([])}
            />
          )}
        </View>
      )}
      <Panel
        title={status === "reviewed" ? "Reviewed findings" : "Attention"}
        icon="attention"
        action={
          <Badge
            label={`${critical} critical`}
            tone="destructive"
            colors={colors}
          />
        }
        colors={colors}
        style={{ marginBottom: 8 }}
        footer={
          <>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {pending.length} to review
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Review queue"
              accessibilityState={{ disabled: queue.length === 0 }}
              disabled={!queue.length}
              onPress={() => queue[0] && onInspect(queue[0].anomaly_id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                minHeight: 36,
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                opacity: !queue.length ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "500",
                  color: colors.primaryForeground,
                }}
              >
                Review queue
              </Text>
              <Icon name="arrow" color={colors.primaryForeground} size={15} />
            </Pressable>
          </>
        }
      >
        {!visible.length && (
          <View style={{ padding: 24, alignItems: "center", gap: 4 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "500",
              }}
            >
              No matching findings
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              Try another filter.
            </Text>
          </View>
        )}
        <Animated.ScrollView
          nestedScrollEnabled
          style={{ maxHeight: listHeight, opacity: listOpacity }}
          keyboardShouldPersistTaps="handled"
        >
          {visible.map((f, index) => {
            const reviewed = reviewedIds.includes(f.anomaly_id);
            return (
              <Pressable
                key={f.anomaly_id}
                accessibilityRole="button"
                accessibilityLabel={`Inspect ${humanize(f.anomaly_type)} ${f.asset_id}`}
                onPress={() => onInspect(f.anomaly_id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  gap: 12,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.secondary : colors.card,
                })}
              >
                <Image
                  source={findingThumbnail(f.anomaly_type)}
                  accessibilityLabel={`Illustration for ${humanize(f.anomaly_type)}`}
                  style={{
                    width: 52,
                    height: 44,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: colors.foreground,
                        flex: 1,
                      }}
                    >
                      {humanize(f.anomaly_type)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: fonts.mono,
                        color: colors.mutedForeground,
                      }}
                    >
                      {f.anomaly_id}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 11, color: colors.mutedForeground }}
                  >
                    {data.assets.find((a) => a.asset_id === f.asset_id)
                      ?.asset_name || f.asset_id}{" "}
                    · {f.location_id}{" "}
                    {
                      data.locations.find(
                        (l) => l.location_id === f.location_id,
                      )?.location_name
                    }{" "}
                    · {displayTime(f.timestamp)}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 2,
                    }}
                  >
                    <Badge
                      label={humanize(f.severity)}
                      tone={severityTone(f.severity)}
                      colors={colors}
                    />
                    {reviewed && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Icon name="check" color={colors.good} size={12} />
                        <Text style={{ color: colors.good, fontSize: 11 }}>
                          Reviewed
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Icon name="chevron" color={colors.mutedForeground} size={15} />
              </Pressable>
            );
          })}
        </Animated.ScrollView>
      </Panel>
      {datesOpen && (
        <DateRangeSheet
          colors={colors}
          initial={{ start, end }}
          onApply={setRange}
          onClose={() => setDatesOpen(false)}
        />
      )}
      {filtersOpen && (
        <FiltersSheet
          colors={colors}
          severity={severity}
          types={types}
          availableTypes={[
            ...new Set(data.findings.map((f) => f.anomaly_type)),
          ]}
          onSeverity={setSeverity}
          onTypes={(values) => {
            setTypes(values);
            setTypeLabel("");
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </>
  );
}
