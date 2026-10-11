export type Tab = "attention" | "missions" | "facility";
export type EvidenceSelection =
  | { kind: "finding"; findingId: string }
  | { kind: "mission"; missionId: string; actionId: string | null }
  | null;

export function parseAppLink(
  value: string,
): { tab: Tab; selection: EvidenceSelection } | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "com.sentinel.inspections:" ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    if (segments.length > 1) return null;
    if (url.hostname === "findings" && segments[0]) {
      return {
        tab: "attention",
        selection: { kind: "finding", findingId: segments[0] },
      };
    }
    if (url.hostname === "missions" && segments[0]) {
      return {
        tab: "missions",
        selection: {
          kind: "mission",
          missionId: segments[0],
          actionId: url.searchParams.get("action"),
        },
      };
    }
    if (
      !segments.length &&
      ["attention", "missions", "facility"].includes(url.hostname)
    ) {
      return { tab: url.hostname as Tab, selection: null };
    }
    return null;
  } catch {
    return null;
  }
}
