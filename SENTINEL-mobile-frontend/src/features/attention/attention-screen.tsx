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
  type ThemeColors,
} from "@sentinel/core";
import { Badge, SegmentedControl } from "../../ui";
import { Icon } from "../../design/icons";
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

export function AttentionScreen({
  colors,
  onInspect,
  onShowFailedMissions,
}: {
  colors: ThemeColors;
  onInspect: (id: string) => void;
  onShowFailedMissions: () => void;
}) {
  const { data, range, setRange, reviewedIds, scale, largeText } =
    useScreenData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FindingStatus>("required");
  const [severity, setSeverity] = useState<string | null>(null);
  const [types, setTypes] = useState<string[]>([]),
    [typeLabel, setTypeLabel] = useState("");
  const [datesOpen, setDatesOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [queueTop, setQueueTop] = useState(0);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Reserve native chrome and the queue's heading/footer. Large text can
  // scroll the outer screen without compressing its finding rows.
  const listHeight = largeText
    ? 340
    : Math.min(
        240 * scale,
        Math.max(
          120,
          height -
            insets.top -
            insets.bottom -
            46 -
            66 -
            queueTop -
            10 -
            71 * scale,
        ),
      );
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
  const days = data.missions.map((m) => m.start_time.slice(0, 10)).sort();
  const start = range?.start || days[0] || "",
    end = range?.end || days.at(-1) || "";
  const metrics = getMetrics(data, "ALL");
  return (
    <>
      <ScreenHeading
        title="Attention"
        colors={colors}
        scale={scale}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose mission dates"
            onPress={() => setDatesOpen(true)}
            hitSlop={6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 9,
              minHeight: 28 * scale,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 4,
              backgroundColor: colors.surface,
            }}
          >
            <Icon name="calendar" size={13} color={colors.ink} />
            <Text style={{ fontSize: 10 * scale, color: colors.muted }}>
              {displayDateRange(start, end)}
            </Text>
            <Icon name="down" size={12} color={colors.muted} />
          </Pressable>
        }
      />
      <MetricBand
        data={data}
        pending={pending.length}
        critical={critical}
        colors={colors}
        scale={scale}
      />
      <SummaryCharts
        data={data}
        colors={colors}
        scale={scale}
        stacked={largeText}
        onSeverity={setSeverity}
        onTypes={(values, label) => {
          setTypes(values);
          setTypeLabel(label);
        }}
      />
      {metrics.completedWithFailures > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Inspect completed missions with failed actions"
          onPress={onShowFailedMissions}
          hitSlop={7}
          style={{
            minHeight: 29 * scale,
            marginBottom: 12 * scale,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderLeftWidth: 2,
            borderColor: colors.line,
            borderLeftColor: colors.amber,
            backgroundColor: colors.surface,
            borderRadius: 4,
            paddingHorizontal: 10 * scale,
            gap: 8,
          }}
        >
          <Icon name="attention" color={colors.amber} size={16} />
          <Text style={{ color: colors.ink, fontSize: 10.5 * scale, flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>
              {metrics.completedWithFailures} completed missions
            </Text>{" "}
            have failed actions
          </Text>
          <Text style={{ color: colors.blue, fontSize: 11 * scale }}>
            Inspect
          </Text>
          <Icon name="external" color={colors.blue} size={13} />
        </Pressable>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 4,
          paddingHorizontal: 11 * scale,
          gap: 10,
          marginBottom: 4 * scale,
        }}
      >
        <Icon name="search" color={colors.ink} size={17} />
        <TextInput
          accessibilityLabel="Search findings"
          placeholder="Asset or waypoint"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            color: colors.ink,
            fontSize: 12 * scale,
            flex: 1,
            minHeight: 34 * scale,
            paddingVertical: 5,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 11 * scale,
          marginBottom: 6 * scale,
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
          hitSlop={6}
          style={{
            width: 31 * scale,
            height: 31 * scale,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 4,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <Icon name="filters" size={16} color={colors.blue} />
        </Pressable>
      </View>
      {(severity || types.length > 0) && (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          {severity && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Clear ${humanize(severity)} filter`}
              onPress={() => setSeverity(null)}
              style={{
                padding: 8,
                backgroundColor: colors.blueSoft,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.blue, fontSize: 11 }}>
                {humanize(severity)} ×
              </Text>
            </Pressable>
          )}
          {!!types.length && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear type filter"
              onPress={() => setTypes([])}
              style={{
                padding: 8,
                backgroundColor: colors.blueSoft,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.blue, fontSize: 11 }}>
                {typeLabel || "Type filter"} ×
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <View
        onLayout={({ nativeEvent }) => setQueueTop(nativeEvent.layout.y)}
        style={{
          borderWidth: 1,
          borderColor: "#cce0f8",
          borderRadius: 4,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 11 * scale,
            minHeight: 35 * scale,
            backgroundColor: colors.blueSoft,
            borderBottomWidth: 1,
            borderColor: "#cce0f8",
          }}
        >
          <Icon name="attention" color={colors.ink} size={19} />
          <Text
            style={{
              fontSize: 13 * scale,
              fontWeight: "600",
              color: colors.ink,
              flex: 1,
            }}
          >
            {status === "reviewed" ? "Reviewed findings" : "Attention"}
          </Text>
          <Badge
            label={`${critical} critical`}
            severity="CRITICAL"
            colors={colors}
          />
          <Icon name="chevron" color={colors.muted} size={13} />
        </View>
        {!visible.length && (
          <Text
            style={{
              color: colors.muted,
              padding: 24,
              textAlign: "center",
              fontSize: 12,
            }}
          >
            No matching findings
          </Text>
        )}
        <Animated.ScrollView
          nestedScrollEnabled
          style={{
            maxHeight: listHeight,
            opacity: listOpacity,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {visible.map((f) => (
            <Pressable
              key={f.anomaly_id}
              accessibilityRole="button"
              accessibilityLabel={`Inspect ${humanize(f.anomaly_type)} ${f.asset_id}`}
              onPress={() => onInspect(f.anomaly_id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                paddingVertical: 5 * scale,
                paddingHorizontal: 11 * scale,
                minHeight: 60 * scale,
                gap: 14 * scale,
                borderBottomWidth: 1,
                borderColor: colors.line,
                backgroundColor: pressed ? colors.raised : colors.surface,
              })}
            >
              <Image
                source={findingThumbnail(f.anomaly_type)}
                accessibilityLabel={`Illustration for ${humanize(f.anomaly_type)}`}
                style={{
                  width: 57 * scale,
                  height: 45 * scale,
                  borderRadius: 2,
                  alignSelf: "center",
                }}
                resizeMode="cover"
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Badge
                    label={humanize(f.severity)}
                    severity={f.severity}
                    colors={colors}
                  />
                  <Text
                    style={{
                      fontSize: 9 * scale,
                      fontFamily: "Menlo",
                      color: colors.muted,
                    }}
                  >
                    {f.anomaly_id}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12.5 * scale,
                      lineHeight: 14 * scale,
                      fontWeight: "600",
                      color: colors.ink,
                      flex: 1,
                    }}
                  >
                    {humanize(f.anomaly_type)}
                  </Text>
                  <Icon name="chevron" color={colors.muted} size={13} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 9.5 * scale,
                    lineHeight: 12 * scale,
                    color: colors.muted,
                  }}
                >
                  {data.assets.find((a) => a.asset_id === f.asset_id)
                    ?.asset_name || f.asset_id}{" "}
                  · {f.location_id}{" "}
                  {
                    data.locations.find((l) => l.location_id === f.location_id)
                      ?.location_name
                  }{" "}
                  · {displayTime(f.timestamp)}
                </Text>
                {reviewedIds.includes(f.anomaly_id) && (
                  <Text style={{ color: colors.green, fontSize: 10 }}>
                    Reviewed
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </Animated.ScrollView>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 11 * scale,
            minHeight: 36 * scale,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 11 * scale }}>
            {pending.length} to review
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review queue"
            accessibilityState={{ disabled: queue.length === 0 }}
            disabled={!queue.length}
            onPress={() => queue[0] && onInspect(queue[0].anomaly_id)}
            hitSlop={6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderRadius: 4,
              backgroundColor: colors.greenFill,
              paddingHorizontal: 10 * scale,
              paddingVertical: 7 * scale,
              opacity: queue.length ? 1 : 0.5,
            }}
          >
            <Text
              style={{
                fontSize: 11 * scale,
                fontWeight: "500",
                color: "#173b30",
              }}
            >
              Review queue
            </Text>
            <Icon name="arrow" color="#173b30" size={15} />
          </Pressable>
        </View>
      </View>
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
