import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { getFindings, humanize, type ThemeColors } from "@sentinel/core";
import { ScreenHeading, useScreenData } from "../shared";
import { Badge, Button } from "../../ui";
import { Icon } from "../../design/icons";
import { FacilityMap } from "./facility-map";
import { mapLayout } from "./map-layout";

export function FacilityScreen({
  colors,
  onInspect,
}: {
  colors: ThemeColors;
  onInspect: (id: string) => void;
}) {
  const { data, reviewedIds, scale, largeText } = useScreenData();
  const [selectedId, setSelectedId] = useState<string | null>("WP05");
  const [floor, setFloor] = useState<number | null>(null);
  const [floorOpen, setFloorOpen] = useState(false);
  useEffect(() => {
    if (
      floor !== null &&
      !data.locations.some((location) => location.floor === floor)
    )
      setFloor(null);
  }, [data.locations, floor]);
  const locations = data.locations.filter(
    (l) => floor === null || l.floor === floor,
  );
  const selected =
    locations.find((l) => l.location_id === selectedId) ||
    locations.find((l) => l.location_id === "WP05") ||
    locations[0];
  const allFindings = getFindings(data, { status: "all" });
  const pending = getFindings(data, { reviewedIds });
  const findings = selected
    ? allFindings
        .filter((f) => f.location_id === selected.location_id)
        .sort(
          (a, b) => Number(pending.includes(b)) - Number(pending.includes(a)),
        )
    : [];
  const pendingCount = selected
    ? pending.filter((f) => f.location_id === selected.location_id).length
    : 0;
  const counts = Object.fromEntries(
    locations.map((l) => [
      l.location_id,
      allFindings.filter((f) => f.location_id === l.location_id).length,
    ]),
  );
  const floors = [...new Set(data.locations.map((l) => l.floor))].sort(
    (a, b) => a - b,
  );
  return (
    <>
      <ScreenHeading
        title="Facility"
        subtitle={`${locations.length} waypoints  ·  ${floor === null ? "All floors" : `Floor ${floor}`}`}
        colors={colors}
        scale={scale}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose floor"
            onPress={() => setFloorOpen(true)}
            style={{
              minHeight: 44,
              paddingHorizontal: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {floor === null ? "All floors" : `Floor ${floor}`}
            </Text>
            <Icon name="down" color={colors.muted} size={13} />
          </Pressable>
        }
      />
      {!!locations.length && (
        <FacilityMap
          locations={locations}
          selectedId={selected?.location_id || null}
          onSelect={setSelectedId}
          findingCounts={counts}
          colors={colors}
        />
      )}
      {!locations.length && (
        <Text style={{ padding: 24, color: colors.muted }}>
          No waypoints available.
        </Text>
      )}
      {selected && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 6,
            backgroundColor: colors.raised,
            padding: 12 * scale,
            marginBottom: 10 * scale,
            gap: 5 * scale,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Menlo",
                fontSize: 11 * scale,
                color: colors.ink,
                backgroundColor: colors.line,
                padding: 5,
                borderRadius: 3,
              }}
            >
              {selected.location_id}
            </Text>
            <Badge
              label={`${findings.length} findings`}
              severity={pendingCount ? "HIGH" : "LOW"}
              colors={colors}
            />
          </View>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 16 * scale,
              fontWeight: "700",
              color: colors.ink,
            }}
          >
            {selected.location_name}
          </Text>
          <Text style={{ fontSize: 11 * scale, color: colors.muted }}>
            Floor {selected.floor} · {humanize(selected.environment)}
          </Text>
          <Text
            accessible
            accessibilityLabel="Selected waypoint finding counts"
            accessibilityValue={{
              text: `${findings.length} findings, ${pendingCount} to review`,
            }}
            style={{ fontSize: 10 * scale, color: colors.muted }}
          >
            {pendingCount} to review
          </Text>
          {!mapLayout[selected.location_id] && (
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Map position unavailable for {selected.location_id}.
            </Text>
          )}
        </View>
      )}
      {!!locations.length && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 6,
            backgroundColor: colors.surface,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: largeText ? 340 : 220 * scale }}
          >
            {locations.map((location) => (
              <Pressable
                key={location.location_id}
                accessibilityRole="button"
                accessibilityLabel={`Waypoint ${location.location_id} ${location.location_name}`}
                accessibilityState={{
                  selected: location.location_id === selected?.location_id,
                }}
                onPress={() => setSelectedId(location.location_id)}
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16 * scale,
                  gap: 14 * scale,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                  backgroundColor:
                    location.location_id === selected?.location_id
                      ? colors.raised
                      : colors.surface,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Menlo",
                    color: colors.ink,
                    fontSize: 12 * scale,
                  }}
                >
                  {location.location_id}
                </Text>
                <View
                  style={{
                    height: 15,
                    borderLeftWidth: 1,
                    borderColor: colors.line,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    color: colors.ink,
                    fontSize: 12 * scale,
                    fontWeight:
                      location.location_id === selected?.location_id
                        ? "600"
                        : "400",
                  }}
                >
                  {location.location_name}
                </Text>
                <Icon name="chevron" size={14} color={colors.muted} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {!!findings.length && (
        <View style={{ gap: 6, marginBottom: 12 }}>
          <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 12 }}>
            Waypoint findings
          </Text>
          {findings.map((f) => (
            <Pressable
              key={f.anomaly_id}
              accessibilityRole="button"
              accessibilityLabel={`Inspect location finding ${f.anomaly_id}`}
              onPress={() => onInspect(f.anomaly_id)}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 8,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 4,
                backgroundColor: colors.surface,
              }}
            >
              <Badge
                label={humanize(f.severity)}
                severity={f.severity}
                colors={colors}
              />
              <Text style={{ flex: 1, fontSize: 11, color: colors.ink }}>
                {humanize(f.anomaly_type)}
                {reviewedIds.includes(f.anomaly_id) ? " · Reviewed" : ""}
              </Text>
              <Icon name="chevron" size={14} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      )}
      <Modal
        visible={floorOpen}
        transparent
        animationType="none"
        onRequestClose={() => setFloorOpen(false)}
      >
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#0008",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close floor chooser"
            onPress={() => setFloorOpen(false)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              padding: 24,
              paddingBottom: 44,
              gap: 10,
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ fontSize: 20, fontWeight: "700", color: colors.ink }}
            >
              Choose floor
            </Text>
            {[null, ...floors].map((value) => (
              <Button
                key={value ?? "all"}
                label={value === null ? "All floors" : `Floor ${value}`}
                colors={colors}
                selected={floor === value}
                onPress={() => {
                  setFloor(value);
                  setFloorOpen(false);
                }}
              />
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}
