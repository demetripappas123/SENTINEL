export const inspectionImages: Record<string, number> = {
  "thermal_pump_bearing_01.jpg": require("../assets/demo/thermal_pump_bearing_01.jpg"),
  "acoustic_valve_01.jpg": require("../assets/demo/acoustic_valve_01.jpg"),
  "gauge_pressure_01.jpg": require("../assets/demo/gauge_pressure_01.jpg"),
  "visual_pump_motor_01.jpg": require("../assets/demo/visual_pump_motor_01.jpg"),
  "pipe_gallery_01.jpg": require("../assets/demo/pipe_gallery_01.jpg"),
};
// Same floor plan the web dashboard renders, with a matching dark variant.
export const facilityMap = {
  light: require("../assets/demo/facility.jpg"),
  dark: require("../assets/demo/facility-dark.jpg"),
};
export const brandLogo = require("../assets/brand/logo.png");

const thumbnails = {
  ABNORMAL_TEMPERATURE: require("../assets/design/finding-temperature.png"),
  ABNORMAL_VIBRATION: require("../assets/design/finding-vibration.png"),
  GAUGE_OUT_OF_RANGE: require("../assets/design/finding-gauge.png"),
  SIGNAL_DEGRADATION: require("../assets/design/finding-signal.png"),
};
export function findingThumbnail(type: string): number {
  return (
    thumbnails[type as keyof typeof thumbnails] ||
    inspectionImages["visual_pump_motor_01.jpg"]
  );
}
export const thermalEvidence = require("../assets/design/thermal-evidence.png");
