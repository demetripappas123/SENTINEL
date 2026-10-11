import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getFindings, humanize } from "@sentinel/core";
import { ScreenHeading, useScreenData } from "../shared";
import { Badge, Button, Panel, Sheet, severityTone } from "../../ui";
import { Icon } from "../../design/icons";
import { useReducedMotion } from "../../design/motion";
import { fonts, radii, type Theme } from "../../design/tokens";
import { FacilityMap } from "./facility-map";
import { mapLayout } from "./map-layout";
import { AssetSheet } from "./asset-sheet";

export function FacilityScreen({
  colors,
  onInspect,
}: {
  colors: Theme;
  onInspect: (id: string) => void;
}) {
  const { data, reviewedIds, largeText } = useScreenData();
  const reducedMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>("WP05");
  const [floor, setFloor] = useState<number | null>(null);
  const [floorOpen, setFloorOpen] = useState(false);
  const [assetId, setAssetId] = useState<string | null>(null);
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
  const assets = selected
    ? data.assets.filter((a) => a.location_id === selected.location_id)
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
  const floorLabel = floor === null ? "All floors" : `Floor ${floor}`;
  return (
    <>
      <ScreenHeading
        title="Facility"
        subtitle={`${locations.length} waypoints · ${floorLabel}`}
        colors={colors}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose floor"
            onPress={() => setFloorOpen(true)}
            hitSlop={6}
            style={({ pressed }) => ({
              minHeight: 34,
              paddingHorizontal: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.input,
              borderRadius: radii.md,
              backgroundColor: pressed ? colors.muted : colors.background,
            })}
          >
            <Icon name="facility" color={colors.mutedForeground} size={14} />
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              {floorLabel}
            </Text>
            <Icon name="down" color={colors.mutedForeground} size={13} />
          </Pressable>
        }
      />
      {!locations.length && (
        <View
          style={{
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
          }}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            No waypoints available.
          </Text>
        </View>
      )}
      {!!locations.length && (
        <Panel
          title="Floor plan"
          icon="facility"
          action={
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              {locations.length} waypoints
            </Text>
          }
          colors={colors}
        >
          <FacilityMap
            locations={locations}
            selectedId={selected?.location_id || null}
            floor={floor}
            onSelect={setSelectedId}
            findingCounts={counts}
            colors={colors}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: colors.secondary,
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
              {floors.length} {floors.length === 1 ? "floor" : "floors"} ·
              Illustrative layout
            </Text>
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
              Pinch to zoom
            </Text>
          </View>
          {selected && (
            <>
              {/* Web `.location-note`: highlighted waypoint id beside its name. */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 6,
                    borderRadius: 4,
                    backgroundColor: colors.brand,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: colors.brandForeground,
                    }}
                  >
                    {selected.location_id}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    {selected.location_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    Floor {selected.floor} · {humanize(selected.environment)}
                  </Text>
                </View>
              </View>
              {!mapLayout[selected.location_id] && (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    paddingHorizontal: 16,
                    paddingBottom: 10,
                  }}
                >
                  Map position unavailable for {selected.location_id}.
                </Text>
              )}
              <View
                accessible
                accessibilityLabel="Selected waypoint finding counts"
                accessibilityValue={{
                  text: `${findings.length} findings, ${pendingCount} to review`,
                }}
                style={{
                  flexDirection: "row",
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {(
                  [
                    ["Findings", findings.length, colors.foreground],
                    [
                      "To review",
                      pendingCount,
                      pendingCount ? colors.bad : colors.good,
                    ],
                  ] as const
                ).map(([label, value, tint], index) => (
                  <View
                    key={label}
                    style={{
                      flex: 1,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderLeftWidth: index ? 1 : 0,
                      borderColor: colors.border,
                      gap: 2,
                    }}
                  >
                    <Text
                      style={{ fontSize: 11, color: colors.mutedForeground }}
                    >
                      {label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "600",
                        letterSpacing: -0.5,
                        color: tint,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
              {!!assets.length && (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.mutedForeground,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: 6,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  Assets · {assets.length}
                </Text>
              )}
              {assets.map((a) => (
                <Pressable
                  key={a.asset_id}
                  accessibilityRole="button"
                  accessibilityLabel={`View asset ${a.asset_name}`}
                  onPress={() => setAssetId(a.asset_id)}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.secondary : colors.card,
                  })}
                >
                  <Icon name="scan" color={colors.mutedForeground} size={15} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: colors.foreground,
                      }}
                    >
                      {a.asset_name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: fonts.mono,
                        color: colors.mutedForeground,
                      }}
                    >
                      {a.asset_id} · {humanize(a.asset_type)}
                    </Text>
                  </View>
                  <Icon
                    name="chevron"
                    size={15}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ))}
              {findings.map((f) => {
                const reviewed = reviewedIds.includes(f.anomaly_id);
                return (
                  <Pressable
                    key={f.anomaly_id}
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect location finding ${f.anomaly_id}`}
                    onPress={() => onInspect(f.anomaly_id)}
                    style={({ pressed }) => ({
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.secondary : colors.card,
                    })}
                  >
                    <Icon
                      name={reviewed ? "check" : "attention"}
                      color={
                        reviewed
                          ? colors.good
                          : ["CRITICAL", "HIGH"].includes(f.severity)
                            ? colors.destructive
                            : colors.foreground
                      }
                      size={15}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: colors.foreground,
                        }}
                      >
                        {humanize(f.anomaly_type)}
                        {reviewed ? " · Reviewed" : ""}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: fonts.mono,
                          color: colors.mutedForeground,
                        }}
                      >
                        {f.anomaly_id} · {f.asset_id}
                      </Text>
                    </View>
                    <Badge
                      label={humanize(f.severity)}
                      tone={severityTone(f.severity)}
                      colors={colors}
                    />
                    <Icon
                      name="chevron"
                      size={15}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                );
              })}
            </>
          )}
        </Panel>
      )}
      {!!locations.length && (
        <Panel
          title="Waypoints"
          icon="pin"
          action={
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              Findings
            </Text>
          }
          colors={colors}
        >
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: largeText ? 340 : 264 }}
          >
            {locations.map((location, index) => {
              const active = location.location_id === selected?.location_id;
              const count = counts[location.location_id] || 0;
              return (
                <Pressable
                  key={location.location_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Waypoint ${location.location_id} ${location.location_name}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedId(location.location_id)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    gap: 12,
                    borderTopWidth: index ? 1 : 0,
                    borderColor: colors.border,
                    backgroundColor:
                      active || pressed ? colors.secondary : colors.card,
                  })}
                >
                  {/* Web nav-current marker for the active row. */}
                  {active && (
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 2,
                        borderRadius: 1,
                        backgroundColor: colors.brand,
                      }}
                    />
                  )}
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      color: colors.mutedForeground,
                      fontSize: 11,
                      width: 36,
                    }}
                  >
                    {location.location_id}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontSize: 13,
                      fontWeight: active ? "600" : "400",
                    }}
                  >
                    {location.location_name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: count ? colors.foreground : colors.mutedForeground,
                    }}
                  >
                    {count}
                  </Text>
                  <Icon
                    name="chevron"
                    size={14}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </Panel>
      )}
      <AssetSheet
        assetId={assetId}
        data={data}
        colors={colors}
        reducedMotion={reducedMotion}
        onClose={() => setAssetId(null)}
        onInspect={onInspect}
      />
      <Sheet
        title="Choose floor"
        visible={floorOpen}
        colors={colors}
        reducedMotion={reducedMotion}
        onClose={() => setFloorOpen(false)}
        backdropLabel="Close floor chooser"
      >
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
      </Sheet>
    </>
  );
}
