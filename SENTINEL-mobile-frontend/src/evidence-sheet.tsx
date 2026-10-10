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
  type ThemeColors,
} from "@sentinel/core";
import type { EvidenceSelection } from "./navigation";
import { useScreenData, displayTime } from "./features/shared";
import { Badge, Button } from "./ui";
import { Icon } from "./design/icons";
import { selectionFeedback } from "./design/motion";
import { inspectionImages, thermalEvidence } from "./assets";

export function EvidenceSheet({
  selection,
  onClose,
  colors,
  reducedMotion,
}: {
  selection: EvidenceSelection;
  onClose: () => void;
  colors: ThemeColors;
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
  colors: ThemeColors;
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
    scale,
  } = useScreenData();
  const sheet = useRef<BottomSheetModal>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const { bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const imageWidth = Math.max(1, width - 44 * scale);
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
                    paddingHorizontal: 22 * scale,
                    paddingTop: 8,
                    paddingBottom: Math.max(bottom, 14),
                    gap: 5,
                    borderTopWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: colors.surface,
                  }}
                >
                  {reviewError && (
                    <Text
                      accessibilityRole="alert"
                      style={{ color: colors.red, fontSize: 12 }}
                    >
                      {reviewError}
                    </Text>
                  )}
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {reviewed
                      ? "Reviewed · saved on this device"
                      : "Reviews saved on this device"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      saving
                        ? "Saving…"
                        : !reviewStorageReady
                          ? "Reload saved reviews"
                          : reviewError
                            ? "Retry save"
                            : reviewed
                              ? "Undo review"
                              : "Mark reviewed"
                    }
                    accessibilityState={{ disabled: saving || loading }}
                    disabled={saving || loading}
                    onPress={() => {
                      if (!reviewStorageReady) void refresh();
                      else void changeReview();
                    }}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      borderRadius: 6,
                      backgroundColor: colors.ink,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: saving ? 0.5 : pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.surface,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {saving
                        ? "Saving…"
                        : !reviewStorageReady
                          ? "Reload saved reviews"
                          : reviewError
                            ? "Retry save"
                            : reviewed
                              ? "Undo review"
                              : "Mark reviewed"}
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
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      handleIndicatorStyle={{ width: 34, backgroundColor: "#ccd1d8" }}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            paddingHorizontal: 22 * scale,
            paddingBottom: 10 * scale,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              color: colors.ink,
              fontSize: 25 * scale,
              lineHeight: 30 * scale,
              fontWeight: "700",
              letterSpacing: -0.8,
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.raised,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" color={colors.ink} size={22} />
          </Pressable>
        </View>
        <BottomSheetScrollView
          enableFooterMarginAdjustment={!!finding}
          contentContainerStyle={{
            paddingHorizontal: 22 * scale,
            paddingBottom: 14,
            gap: 12 * scale,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {finding && (
            <>
              <View
                accessible
                accessibilityLabel={`Finding severity: ${humanize(finding.severity)}`}
              >
                <Badge
                  label={humanize(finding.severity)}
                  severity={finding.severity}
                  colors={colors}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    fontSize: 19 * scale,
                    fontWeight: "700",
                    color: colors.ink,
                  }}
                >
                  {data.assets.find((a) => a.asset_id === finding.asset_id)
                    ?.asset_name || finding.asset_id}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12 * scale,
                    fontFamily: "Menlo",
                  }}
                >
                  {finding.mission_id} · {finding.location_id} ·{" "}
                  {data.locations.find(
                    (l) => l.location_id === finding.location_id,
                  )?.location_name || "Location unavailable"}
                </Text>
              </View>
            </>
          )}
          {mission && (
            <>
              <Text
                style={{ fontSize: 18, fontWeight: "600", color: colors.ink }}
              >
                {actions.filter((a) => a.status === "SUCCESS").length} /{" "}
                {actions.length} successful
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 8 }}
              >
                {actions.map((a) => (
                  <View key={a.action_id} style={{ maxWidth: 220 }}>
                    <Button
                      label={`${a.sequence}. ${humanize(a.action_type)} · ${a.action_id} · ${humanize(a.status)}`}
                      colors={colors}
                      selected={a.action_id === action?.action_id}
                      onPress={() => setActionId(a.action_id)}
                    />
                  </View>
                ))}
              </ScrollView>
              {action && (
                <View
                  accessible
                  accessibilityLabel="Selected action context"
                  accessibilityValue={{
                    text: `${action.action_id} · ${action.asset_id} · ${action.location_id} ${data.locations.find((l) => l.location_id === action.location_id)?.location_name || "Location unavailable"}`,
                  }}
                  style={{ gap: 4 }}
                >
                  <Text
                    style={{
                      color: colors.ink,
                      fontWeight: "700",
                      fontSize: 18 * scale,
                    }}
                  >
                    {data.assets.find((a) => a.asset_id === action.asset_id)
                      ?.asset_name || action.asset_id}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 * scale }}>
                    {action.action_id} · {action.asset_id} ·{" "}
                    {action.location_id}{" "}
                    {data.locations.find(
                      (l) => l.location_id === action.location_id,
                    )?.location_name || "Location unavailable"}
                  </Text>
                </View>
              )}
            </>
          )}
          {image && !imageFailed ? (
            <View>
              <Image
                source={image}
                resizeMode="cover"
                accessibilityLabel="Illustrative inspection sample"
                onError={() => setImageFailed(true)}
                style={{
                  width: imageWidth,
                  height: imageWidth / 2.27,
                  borderRadius: 7,
                }}
              />
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10 * scale,
                  marginTop: 4,
                }}
              >
                Kit illustration · not this record’s capture
              </Text>
            </View>
          ) : (
            <Text style={{ color: colors.muted, paddingVertical: 12 }}>
              No image available.
            </Text>
          )}
          {action ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.raised,
                borderRadius: 7,
                paddingHorizontal: 13 * scale,
              }}
            >
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
                    paddingVertical: 11 * scale,
                    borderTopWidth: index ? 1 : 0,
                    borderColor: colors.line,
                  }}
                >
                  <Text style={{ fontSize: 12 * scale, color: colors.muted }}>
                    {label}
                  </Text>
                  <Text style={{ fontSize: 12 * scale, color: colors.ink }}>
                    {value}
                  </Text>
                </View>
              ))}
              {action.status === "FAILED" && (
                <Text
                  style={{
                    color: colors.amber,
                    fontWeight: "600",
                    paddingBottom: 10,
                  }}
                >
                  {humanize(action.failure_type)}
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.muted }}>No action recorded.</Text>
          )}
          <Text
            style={{
              color: colors.ink,
              fontSize: 17 * scale,
              fontWeight: "700",
              marginTop: 4,
            }}
          >
            Readings
          </Text>
          {readings.map((r) => (
            <View
              key={r.reading_id}
              style={{
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 7,
                padding: 12 * scale,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 12 * scale,
                    fontWeight: "600",
                  }}
                >
                  {humanize(r.measurement_type)}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 10 * scale,
                    marginTop: 3,
                  }}
                >
                  Quality: {humanize(r.quality)}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 18 * scale,
                  fontWeight: "700",
                }}
              >
                {r.value} {r.unit}
              </Text>
            </View>
          ))}
          {!readings.length && (
            <Text style={{ color: colors.muted }}>No reading recorded.</Text>
          )}
          {finding && (
            <Text style={{ color: colors.muted, fontSize: 12 * scale }}>
              {formatFindingDescription(finding.description)}
            </Text>
          )}
          {linkedFindings.map((f) => (
            <View key={f.anomaly_id} style={{ gap: 6 }}>
              <Badge
                label={humanize(f.severity)}
                severity={f.severity}
                colors={colors}
              />
              <Text style={{ color: colors.ink, fontWeight: "600" }}>
                {humanize(f.anomaly_type)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatFindingDescription(f.description)}
              </Text>
            </View>
          ))}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
}
