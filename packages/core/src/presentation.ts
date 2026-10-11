import type { QueueItem } from "./api/client";

const labels: Record<string, string> = {
  UNKNOWN: "Not recorded",
  DEFINED: "Planned",
  QUESTIONABLE: "Needs verification",
  UNSUPPORTED_CLAIM: "Finding needs verification",
  EQUIPMENT_FINDING: "Equipment finding",
  POTENTIAL_ANOMALY: "Potential anomaly",
  LOCALIZATION_CONFIDENCE_PCT: "Position confidence",
  TEMPERATURE_C: "Temperature",
  PRESSURE_PSI: "Pressure",
  VIBRATION_MM_S: "Vibration",
  SOUND_DB: "Sound level",
  ACOUSTIC_DB: "Sound level",
  VISUAL_SCORE: "Visual condition score",
};

export function configurationLabel(version: string | null | undefined): string | null {
  if (version === "V1") return "Baseline";
  if (version === "V2") return "Improved";
  return null;
}

export function formatLabel(value: string): string {
  const words = value.trim().replace(/([a-z\d])([A-Z])/g, "$1_$2");
  const key = words
    .toUpperCase()
    .replace(/^(STATUS|ACTION_STATUS|MISSION_STATUS|RUN_STATUS)_/, "");
  return (
    labels[key] ??
    key
      .toLowerCase()
      .replace(/[_\s]+/g, " ")
      .replace(/^./, (char) => char.toUpperCase())
  );
}

export function formatFindingDescription(value: string): string {
  return value
    .trim()
    .replace(/^Synthetic /, "")
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, (code) =>
      formatLabel(code).toLowerCase(),
    )
    .replace(/^./, (char) => char.toUpperCase());
}

const failureGuidance: Record<string, { summary: string; nextStep: string }> = {
  COMMUNICATION_LOSS: {
    summary: "The robot lost its connection during the inspection.",
    nextStep:
      "Check connectivity at this location before retrying the inspection.",
  },
  OBSTACLE_DETECTION: {
    summary: "The robot detected an obstacle on its route.",
    nextStep: "Check the route for obstructions before retrying this waypoint.",
  },
  PATH_BLOCKED: {
    summary: "The robot’s route to the inspection point was blocked.",
    nextStep: "Check access to the waypoint before retrying the inspection.",
  },
  READING_UNRELIABLE: {
    summary: "The measurement could not be trusted.",
    nextStep:
      "Check the sensor and take another reading before assessing equipment condition.",
  },
  SIGNAL_NOISE: {
    summary: "Interference made the sensor signal difficult to interpret.",
    nextStep: "Check for interference and repeat the measurement.",
  },
  TARGET_NOT_DETECTED: {
    summary: "The robot could not identify the intended inspection target.",
    nextStep:
      "Check the target’s visibility and camera position before retrying.",
  },
  SENSOR_TIMEOUT: {
    summary:
      "The sensor did not respond in time, so this inspection could not be completed.",
    nextStep: "Check the sensor connection and retry the inspection.",
  },
  LOCALIZATION_ERROR: {
    summary: "The robot could not reliably determine its position.",
    nextStep:
      "Review the route and the robot’s position before retrying this waypoint.",
  },
  LOCALIZATION_FAILURE: {
    summary: "The robot could not reliably determine its position.",
    nextStep:
      "Review the route and the robot’s position before retrying this waypoint.",
  },
  OBSTACLE_DETECTED: {
    summary:
      "An obstacle prevented the robot from completing this part of the route.",
    nextStep: "Check the route for obstructions before retrying this waypoint.",
  },
  NAVIGATION_FAILURE: {
    summary: "The robot could not reach the inspection point.",
    nextStep:
      "Review the route and waypoint access before retrying the inspection.",
  },
  LOW_BATTERY: {
    summary:
      "The robot did not have enough battery to complete the inspection.",
    nextStep: "Check the robot’s charge before scheduling another inspection.",
  },
  QUESTIONABLE_READING: {
    summary:
      "The recorded measurement is not reliable enough to assess equipment condition.",
    nextStep:
      "Check the sensor and take another reading before drawing conclusions.",
  },
  IMAGE_BLUR: {
    summary: "The inspection image was too blurry to assess reliably.",
    nextStep: "Check camera focus and capture a clearer image.",
  },
  POOR_LIGHTING: {
    summary: "Lighting was insufficient for a reliable visual inspection.",
    nextStep:
      "Check lighting at the inspection point and capture another image.",
  },
};

export function nextStepForFailure(cause: string): string {
  return (
    failureGuidance[cause]?.nextStep ??
    "Review the inspection evidence and retry the affected check when ready."
  );
}

export function describeQueueItem(item: QueueItem) {
  let summary: string;
  let nextStep: string;
  if (item.verdict === "inspection_failure") {
    summary =
      failureGuidance[item.cause]?.summary ??
      formatFindingDescription(item.explanation);
    nextStep = nextStepForFailure(item.cause);
  } else if (item.verdict === "unsupported_claim") {
    summary =
      "There is not enough reliable evidence to confirm an equipment problem. " +
      formatFindingDescription(item.explanation);
    nextStep =
      "Review the evidence and collect a reliable measurement before deciding whether maintenance is needed.";
  } else if (item.verdict === "potential_anomaly") {
    summary = formatFindingDescription(item.explanation);
    nextStep =
      "Treat this as a possible equipment problem. Collect more good readings on this asset before confirming it.";
  } else {
    summary = formatFindingDescription(item.explanation);
    nextStep =
      "Compare this measurement with the equipment’s operating limits and recent readings to decide whether maintenance is needed.";
  }
  const context: string[] = [];
  if (
    item.verdict === "inspection_failure" &&
    item.evidence.mission_status === "COMPLETED"
  ) {
    context.push(
      "The mission completed, but this inspection still needs attention.",
    );
  }
  const repeats = item.evidence.other_failures_on_asset;
  if (typeof repeats === "number" && repeats > 0)
    context.push(
      `This asset has ${repeats} other failed inspection${repeats === 1 ? "" : "s"}.`,
    );
  return { summary, nextStep, context: context.join(" ") };
}
