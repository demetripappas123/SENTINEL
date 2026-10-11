import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Keyboard,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  createApiRepository,
  createFixtureRepository,
  getFindings,
  scopeDataset,
  selectMissionActions,
  type InspectionRepository,
} from "@sentinel/core";
import {
  InspectionProvider,
  useInspection,
} from "./src/state/inspection-provider";
import { createDeviceReviewStore } from "./src/state/device-review-store";
import type { ReviewStore } from "./src/state/review-store";
import { FacilityScreen } from "./src/features/facility/facility-screen";
import { AttentionScreen } from "./src/features/attention/attention-screen";
import { MissionsScreen } from "./src/features/missions/missions-screen";
import { EvidenceSheet } from "./src/evidence-sheet";
import { AppHeader } from "./src/components/app-header";
import { TabBar } from "./src/components/tab-bar";
import { LoadingScreen } from "./src/components/loading-screen";
import { PreferencesSheet } from "./src/components/preferences-sheet";
import {
  alpha,
  colors as themes,
  radii,
  type Appearance,
} from "./src/design/tokens";
import { Icon } from "./src/design/icons";
import { useReducedMotion } from "./src/design/motion";
import type { EvidenceSelection, Tab } from "./src/navigation";
import { parseAppLink } from "./src/navigation";
import { Button } from "./src/ui";
import { LoginScreen, type MobileSession } from "./src/features/login-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
// With an API URL the app shows only backend data, never the bundled fixture.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const defaultRepository = apiUrl
  ? createApiRepository(apiUrl)
  : createFixtureRepository();

export default function App({
  repository = defaultRepository,
  reviewStore,
  requireAuth = process.env.JEST_WORKER_ID == null,
}: {
  repository?: InspectionRepository;
  reviewStore?: ReviewStore;
  requireAuth?: boolean;
}) {
  const deviceStore = useMemo(
    () => createDeviceReviewStore(repository.namespace),
    [repository.namespace],
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider
        initialMetrics={
          initialWindowMetrics || {
            frame: { x: 0, y: 0, width: 0, height: 0 },
            insets: { top: 0, bottom: 0, left: 0, right: 0 },
          }
        }
      >
        <BottomSheetModalProvider>
          <SessionGate requireAuth={requireAuth}>
            <InspectionProvider
              repository={repository}
              reviewStore={reviewStore || deviceStore}
            >
              <AppShell />
            </InspectionProvider>
          </SessionGate>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const SESSION_KEY = "sentinel.session";
const authApiUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

function SessionGate({
  requireAuth,
  children,
}: {
  requireAuth: boolean;
  children: ReactNode;
}) {
  const [session, setSession] = useState<MobileSession | null | undefined>(
    requireAuth ? undefined : null,
  );
  useEffect(() => {
    if (!requireAuth) return;
    let active = true;
    AsyncStorage.getItem(SESSION_KEY)
      .then(async (stored) => {
        if (!stored) return null;
        const saved = JSON.parse(stored) as MobileSession;
        const response = await fetch(authApiUrl + "/api/auth/session", {
          headers: { Authorization: "Bearer " + saved.token },
        });
        return response.ok ? saved : null;
      })
      .then((next) => {
        if (active) setSession(next);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    return () => {
      active = false;
    };
  }, [requireAuth]);
  if (!requireAuth) return children;
  if (session === undefined) return null;
  if (!session) {
    return (
      <LoginScreen
        colors={themes.light}
        onSignedIn={(next) => {
          void AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
          setSession(next);
        }}
      />
    );
  }
  return children;
}

function AppShell() {
  const {
    data: loadedData,
    reviews,
    loading,
    error,
    reviewError,
    saving,
    range,
    refresh,
    resetReviews,
  } = useInspection();
  const data = useMemo(
    () => (loadedData ? scopeDataset(loadedData, range) : null),
    [loadedData, range],
  );
  const [tab, setTab] = useState<Tab>("attention");
  const [appearance, setAppearance] = useState<Appearance>("light");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selection, setSelection] = useState<EvidenceSelection>(null);
  const [started, setStarted] = useState(false);
  const [pendingLink, setPendingLink] =
    useState<ReturnType<typeof parseAppLink>>(null);
  const [onlyCompletedWithFailures, setOnlyCompletedWithFailures] =
    useState(false);
  const reducedMotion = useReducedMotion();
  const colors = themes[appearance];
  const reviewedIds = reviews.map((review) => review.findingId);
  const finding =
    selection?.kind === "finding"
      ? data?.findings.find((f) => f.anomaly_id === selection.findingId) || null
      : null;
  const mission =
    selection?.kind === "mission"
      ? data?.missions.find((m) => m.mission_id === selection.missionId) || null
      : null;
  const overlayOpen = preferencesOpen || !!finding || !!mission;
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const subscription = Linking.addEventListener("url", ({ url }) => {
      receivedEvent = true;
      const route = parseAppLink(url);
      if (route) setPendingLink(route);
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (active && !receivedEvent && url) setPendingLink(parseAppLink(url));
      })
      .catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!pendingLink || !data || loading) return;
    const target = pendingLink.selection;
    const valid =
      !target ||
      (target.kind === "finding"
        ? data.findings.some((f) => f.anomaly_id === target.findingId)
        : data.missions.some((m) => m.mission_id === target.missionId) &&
          (!target.actionId ||
            data.actions.some(
              (a) =>
                a.action_id === target.actionId &&
                a.mission_id === target.missionId,
            )));
    if (valid) {
      Keyboard.dismiss();
      setTab(pendingLink.tab);
      setSelection(target);
    }
    setPendingLink(null);
  }, [pendingLink, data, loading]);
  useEffect(() => {
    if (data && !loading) setStarted(true);
  }, [data, loading]);
  useEffect(() => {
    if (!loading && selection && !finding && !mission) setSelection(null);
  }, [loading, selection, finding, mission]);
  useEffect(() => {
    // React loading follows actual data readiness, with no imposed delay.
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={appearance === "light" ? "dark" : "light"} />
      {!data || (!started && loading) ? (
        loading ? (
          <LoadingScreen colors={colors} reducedMotion={reducedMotion} />
        ) : (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              padding: 16,
              backgroundColor: colors.background,
            }}
          >
            {/* Web `.data-message`: bordered card with heading, copy, action. */}
            <View
              style={{
                gap: 14,
                padding: 24,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.xl,
                backgroundColor: colors.card,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                Inspections unavailable
              </Text>
              <Text
                accessibilityRole="alert"
                style={{ color: colors.mutedForeground, fontSize: 14 }}
              >
                {error}
              </Text>
              <Button
                label="Retry"
                variant="default"
                colors={colors}
                style={{ alignSelf: "flex-start" }}
                onPress={() => {
                  void refresh();
                }}
              />
            </View>
          </View>
        )
      ) : (
        <>
          <View
            style={{ flex: 1 }}
            accessibilityElementsHidden={overlayOpen}
            importantForAccessibility={
              overlayOpen ? "no-hide-descendants" : "auto"
            }
          >
            <AppHeader
              colors={colors}
              appearance={appearance}
              onToggleAppearance={() =>
                setAppearance(appearance === "light" ? "dark" : "light")
              }
              onPreferences={() => {
                Keyboard.dismiss();
                setPreferencesOpen(true);
              }}
            />
            {(error || reviewError) && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  margin: 16,
                  marginBottom: 0,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: alpha(colors.destructive, 0.3),
                  borderRadius: radii.xl,
                  backgroundColor: alpha(colors.destructive, 0.06),
                }}
              >
                <Icon name="attention" color={colors.destructive} size={16} />
                <Text
                  accessibilityRole="alert"
                  style={{ flex: 1, color: colors.foreground, fontSize: 13 }}
                >
                  {error || reviewError}
                </Text>
                <Button
                  label="Retry"
                  colors={colors}
                  disabled={loading || saving}
                  onPress={() => {
                    void refresh();
                  }}
                />
              </View>
            )}
            {(["attention", "missions", "facility"] as const).map((screen) => (
              <ScrollView
                key={screen}
                accessibilityLabel={`${screen} content`}
                style={{
                  flex: 1,
                  display: screen === tab ? "flex" : "none",
                  backgroundColor: colors.background,
                }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 20,
                  paddingBottom: 16,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                refreshControl={
                  <RefreshControl
                    accessibilityLabel={`Refresh ${screen === "attention" ? "Attention" : screen === "missions" ? "Missions" : "Facility"}`}
                    refreshing={loading}
                    onRefresh={refresh}
                    tintColor={colors.mutedForeground}
                  />
                }
                accessibilityElementsHidden={screen !== tab}
                importantForAccessibility={
                  screen === tab ? "auto" : "no-hide-descendants"
                }
              >
                {screen === "attention" ? (
                  <AttentionScreen
                    colors={colors}
                    onInspect={(findingId) => {
                      Keyboard.dismiss();
                      setSelection({
                        kind: "finding",
                        findingId,
                      });
                    }}
                    onShowFailedMissions={() => {
                      setOnlyCompletedWithFailures(true);
                      setTab("missions");
                    }}
                  />
                ) : screen === "missions" ? (
                  <MissionsScreen
                    colors={colors}
                    onlyCompletedWithFailures={onlyCompletedWithFailures}
                    onClearFailureFilter={() =>
                      setOnlyCompletedWithFailures(false)
                    }
                    onInspect={(missionId) => {
                      const actions = selectMissionActions(data, missionId);
                      setSelection({
                        kind: "mission",
                        missionId,
                        actionId:
                          (
                            actions.find((a) => a.status === "FAILED") ||
                            actions[0]
                          )?.action_id || null,
                      });
                    }}
                  />
                ) : (
                  <FacilityScreen
                    colors={colors}
                    onInspect={(findingId) =>
                      setSelection({ kind: "finding", findingId })
                    }
                  />
                )}
              </ScrollView>
            ))}
            <TabBar
              tab={tab}
              counts={{
                attention: getFindings(data, { reviewedIds }).length,
                missions: data.missions.length,
                facility: data.locations.length,
              }}
              colors={colors}
              reducedMotion={reducedMotion}
              onSelect={(value) => {
                Keyboard.dismiss();
                setTab(value);
              }}
            />
          </View>
          <EvidenceSheet
            selection={selection}
            reducedMotion={reducedMotion}
            colors={colors}
            onClose={() => setSelection(null)}
          />
          {preferencesOpen && (
            <PreferencesSheet
              colors={colors}
              appearance={appearance}
              reducedMotion={reducedMotion}
              count={reviews.length}
              saving={saving || loading}
              error={reviewError}
              onAppearance={setAppearance}
              onReset={resetReviews}
              onClose={() => setPreferencesOpen(false)}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
