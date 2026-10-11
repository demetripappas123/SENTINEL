import { useEffect, useRef, useState, useCallback } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  humanize,
  formatFindingDescription,
  selectMissionActions,
  selectActionFindings,
  selectActionReadings,
  sampleImage,
} from "@sentinel/core";
import type { EvidenceSelection } from "./navigation";
import { useScreenData, displayTime } from "./features/shared";
import { Badge, Card, IconButton, Overline, severityTone } from "./ui";
import { Icon } from "./design/icons";
import { selectionFeedback } from "./design/motion";
import { alpha, fonts, radii, type Theme } from "./design/tokens";
import { inspectionImages, thermalEvidence } from "./assets";

export function EvidenceSheet({
  selection,
  onClose,
  colors,
  reducedMotion,
}: {
  selection: EvidenceSelection;
  onClose: () => void;
  colors: Theme;
  reducedMotion: boolean;
}) {
  return selection ? (
    <SelectedEvidence
      key={
        selection.kind === "finding" ? selection.findingId : selection.missionId
      }
      selection={selection}
      onClose={onClose}
      colors={colors}
      reducedMotion={reducedMotion}
    />
  ) : null;
}

function SelectedEvidence({
  selection,
  onClose,
  colors,
  reducedMotion,
}: {
  selection: NonNullable<EvidenceSelection>;
  onClose: () => void;
  colors: Theme;
  reducedMotion: boolean;
}) {
  const {
    data,
    reviews,
    saving,
    loading,
    reviewError,
    reviewStorageReady,
    refresh,
    acknowledge,
    undo,
  } = useScreenData();
  const sheet = useRef<BottomSheetModal>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const { bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const imageWidth = Math.max(1, width - 40);
  const [imageFailed, setImageFailed] = useState(false);
  const finding =
    selection.kind === "finding"
      ? data.findings.find((f) => f.anomaly_id === selection.findingId)
      : null;
  const mission =
    selection.kind === "mission"
      ? data.missions.find((m) => m.mission_id === selection.missionId)
      : null;
  const actions = mission ? selectMissionActions(data, mission.mission_id) : [];
  const [actionId, setActionId] = useState(
    selection.kind === "mission" ? selection.actionId : null,
  );
  const requestedActionId =
    selection.kind === "mission" ? selection.actionId : null;
  useEffect(() => {
    setActionId(requestedActionId);
  }, [selection, requestedActionId]);
  const action = finding
    ? data.actions.find((a) => a.action_id === finding.action_id)
    : actions.find((a) => a.action_id === actionId) ||
      actions.find((a) => a.status === "FAILED") ||
      actions[0];
  const readings = action ? selectActionReadings(data, action.action_id) : [];
  const linkedFindings =
    !finding && action ? selectActionFindings(data, action.action_id) : [];
  const reviewed =
    !!finding && reviews.some((r) => r.findingId === finding.anomaly_id);
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );
  useEffect(() => {
    mounted.current = true;
    sheet.current?.present();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!loading && !finding && !mission) onClose();
  }, [loading, finding, mission, onClose]);
  useEffect(() => {
    setImageFailed(false);
  }, [action?.action_id]);
  const changeReview = async () => {
    if (!finding || inFlight.current || saving || loading) return;
    inFlight.current = true;
    try {
      await (reviewed
        ? undo(finding.anomaly_id)
        : acknowledge(finding.anomaly_id));
      selectionFeedback();
      if (mounted.current) onClose();
    } catch {
      /* The provider exposes the persistence error; keep the sheet open. */
    } finally {
      inFlight.current = false;
    }
  };
  const image = action
    ? finding?.anomaly_type === "ABNORMAL_TEMPERATURE"
      ? thermalEvidence
      : inspectionImages[
          sampleImage(finding?.anomaly_type || action.action_type)
        ]
    : null;
  const reviewLabel = saving
    ? "Saving…"
    : !reviewStorageReady
      ? "Reload saved reviews"
      : reviewError
        ? "Retry save"
        : reviewed
          ? "Undo review"
          : "Mark reviewed";
  const placeLabel = (locationId: string | null | undefined) =>
    data.locations.find((l) => l.location_id === locationId)?.location_name ||
    "Location unavailable";
  const sectionTitle = {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  } as const;
  return (
    <BottomSheetModal
      ref={sheet}
      accessible={false}
      footerComponent={
        finding
          ? (props: BottomSheetFooterProps) => (
              <BottomSheetFooter {...props}>
                <View
                  style={{
                    paddingHorizontal: 20,
                    paddingTop: 10,
                    paddingBottom: Math.max(bottom, 14),
                    gap: 6,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  }}
                >
                  {reviewError && (
                    <Text
                      accessibilityRole="alert"
                      style={{ color: colors.destructive, fontSize: 12 }}
                    >
                      {reviewError}
                    </Text>
                  )}
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                    {reviewed
                      ? "Reviewed · saved on this device"
                      : "Reviews saved on this device"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={reviewLabel}
                    accessibilityState={{ disabled: saving || loading }}
                    disabled={saving || loading}
                    onPress={() => {
                      if (!reviewStorageReady) void refresh();
                      else void changeReview();
                    }}
                    style={({ pressed }) => ({
                      minHeight: 46,
                      flexDirection: "row",
                      gap: 8,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: reviewed ? colors.input : colors.primary,
                      backgroundColor: reviewed
                        ? colors.background
                        : colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: saving ? 0.5 : pressed ? 0.85 : 1,
                    })}
                  >
                    {!saving && reviewStorageReady && !reviewError && (
                      <Icon
                        name={reviewed ? "close" : "check"}
                        color={
                          reviewed
                            ? colors.foreground
                            : colors.primaryForeground
                        }
                        size={16}
                      />
                    )}
                    <Text
                      style={{
                        color: reviewed
                          ? colors.foreground
                          : colors.primaryForeground,
                        fontWeight: "500",
                        fontSize: 14,
                      }}
                    >
                      {reviewLabel}
                    </Text>
                  </Pressable>
                </View>
              </BottomSheetFooter>
            )
          : undefined
      }
      snapPoints={["70%", "92%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      animateOnMount={!reducedMotion}
      overrideReduceMotion={
        reducedMotion ? ReduceMotion.Always : ReduceMotion.System
      }
      onDismiss={onClose}
      backdropComponent={backdrop}
      backgroundStyle={{
        backgroundColor: colors.background,
        borderTopLeftRadius: radii.xl + 6,
        borderTopRightRadius: radii.xl + 6,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      handleIndicatorStyle={{ width: 36, backgroundColor: colors.border }}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            paddingLeft: 20,
            paddingRight: 14,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Overline colors={colors}>
              {finding ? "Finding" : mission ? "Mission" : "Evidence"}
            </Overline>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.foreground,
                fontSize: 21,
                lineHeight: 26,
                fontWeight: "600",
                letterSpacing: -0.5,
              }}
            >
              {finding
                ? humanize(finding.anomaly_type)
                : mission
                  ? /^M\d+$/.test(mission.mission_id)
                    ? `Route ${Number(mission.mission_id.slice(1))}`
                    : mission.mission_name || mission.mission_id
                  : "Evidence"}
            </Text>
          </View>
          <IconButton
            icon="close"
            accessibilityLabel="Close"
            onPress={onClose}
            colors={colors}
            color={colors.foreground}
            bordered
          />
        </View>
        <BottomSheetScrollView
          enableFooterMarginAdjustment={!!finding}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 16,
            gap: 12,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {finding && (
            <View style={{ gap: 8 }}>
              <View
                accessible
                accessibilityLabel={`Finding severity: ${humanize(finding.severity)}`}
              >
                <Badge
                  label={humanize(finding.severity)}
                  tone={severityTone(finding.severity)}
                  colors={colors}
                />
              </View>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                {data.assets.find((a) => a.asset_id === finding.asset_id)
                  ?.asset_name || finding.asset_id}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 12,
                  fontFamily: fonts.mono,
                }}
              >
                {finding.mission_id} · {finding.location_id} ·{" "}
                {placeLabel(finding.location_id)}
              </Text>
            </View>
          )}
          {mission && (
            <>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                {actions.filter((a) => a.status === "SUCCESS").length} /{" "}
                {actions.length} successful
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 8 }}
              >
                {actions.map((a) => {
                  const active = a.action_id === action?.action_id;
                  const tint =
                    a.status === "FAILED"
                      ? colors.destructive
                      : a.status === "SUCCESS"
                        ? colors.good
                        : colors.mutedForeground;
                  return (
                    <Pressable
                      key={a.action_id}
                      accessibilityRole="button"
                      accessibilityLabel={`${a.sequence}. ${humanize(a.action_type)} · ${a.action_id} · ${humanize(a.status)}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setActionId(a.action_id)}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        maxWidth: 220,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        justifyContent: "center",
                        gap: 2,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active
                          ? alpha(colors.brand, 0.1)
                          : pressed
                            ? colors.muted
                            : colors.background,
                      })}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          fontWeight: active ? "600" : "500",
                          color: active ? colors.brand : colors.foreground,
                        }}
                      >
                        {a.sequence}. {humanize(a.action_type)}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: tint,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: fonts.mono,
                            color: colors.mutedForeground,
                          }}
                        >
                          {a.action_id} · {humanize(a.status)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {action && (
                <View
                  accessible
                  accessibilityLabel="Selected action context"
                  accessibilityValue={{
                    text: `${action.action_id} · ${action.asset_id} · ${action.location_id} ${placeLabel(action.location_id)}`,
                  }}
                  style={{ gap: 4 }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "600",
                      fontSize: 17,
                    }}
                  >
                    {data.assets.find((a) => a.asset_id === action.asset_id)
                      ?.asset_name || action.asset_id}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 12,
                      fontFamily: fonts.mono,
                    }}
                  >
                    {action.action_id} · {action.asset_id} ·{" "}
                    {action.location_id} {placeLabel(action.location_id)}
                  </Text>
                </View>
              )}
            </>
          )}
          {image && !imageFailed ? (
            <View style={{ gap: 6 }}>
              <Image
                source={image}
                resizeMode="cover"
                accessibilityLabel="Illustrative inspection sample"
                onError={() => setImageFailed(true)}
                style={{
                  width: imageWidth,
                  height: imageWidth / 2.27,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                Kit illustration · not this record’s capture
              </Text>
            </View>
          ) : (
            <Text
              style={{ color: colors.mutedForeground, paddingVertical: 12 }}
            >
              No image available.
            </Text>
          )}
          {action ? (
            <Card colors={colors}>
              {[
                ["Outcome", humanize(action.status)],
                ["Battery", `${action.battery_pct}%`],
                ["Captured", displayTime(action.timestamp)],
              ].map(([label, value], index) => (
                <View
                  key={label}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    borderTopWidth: index ? 1 : 0,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      color: colors.foreground,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {value}
                  </Text>
                </View>
              ))}
              {action.status === "FAILED" && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: alpha(colors.destructive, 0.08),
                  }}
                >
                  <Icon name="attention" color={colors.destructive} size={14} />
                  <Text
                    style={{
                      color: colors.destructive,
                      fontWeight: "600",
                      fontSize: 12,
                    }}
                  >
                    {humanize(action.failure_type)}
                  </Text>
                </View>
              )}
            </Card>
          ) : (
            <Text style={{ color: colors.mutedForeground }}>
              No action recorded.
            </Text>
          )}
          <Text style={sectionTitle}>Readings</Text>
          {readings.length > 0 && (
            <Card colors={colors}>
              {readings.map((r, index) => (
                <View
                  key={r.reading_id}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    borderTopWidth: index ? 1 : 0,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {humanize(r.measurement_type)}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      Quality: {humanize(r.quality)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 17,
                      fontWeight: "600",
                      letterSpacing: -0.3,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {r.value} {r.unit}
                  </Text>
                </View>
              ))}
            </Card>
          )}
          {!readings.length && (
            <Text style={{ color: colors.mutedForeground }}>
              No reading recorded.
            </Text>
          )}
          {finding && (
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                lineHeight: 20,
              }}
            >
              {formatFindingDescription(finding.description)}
            </Text>
          )}
          {linkedFindings.length > 0 && (
            <>
              <Text style={sectionTitle}>Linked findings</Text>
              <Card colors={colors}>
                {linkedFindings.map((f, index) => (
                  <View
                    key={f.anomaly_id}
                    style={{
                      gap: 6,
                      padding: 14,
                      borderTopWidth: index ? 1 : 0,
                      borderColor: colors.border,
                    }}
                  >
                    <Badge
                      label={humanize(f.severity)}
                      tone={severityTone(f.severity)}
                      colors={colors}
                    />
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {humanize(f.anomaly_type)}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      {formatFindingDescription(f.description)}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          )}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
}
