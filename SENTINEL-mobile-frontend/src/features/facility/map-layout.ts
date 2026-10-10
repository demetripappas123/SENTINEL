// Display positions on the shared 1024×539 floor plan, identical to the web
// dashboard's map (fractions of width/height). They are illustrative only and
// independent of recorded coordinates.
export const MAP_ASPECT = 1024 / 539;
export const mapLayout: Record<string, { x: number; y: number }> = {
  WP01: { x: 0.089, y: 0.739 },
  WP02: { x: 0.083, y: 0.517 },
  WP03: { x: 0.211, y: 0.405 },
  WP04: { x: 0.19, y: 0.143 },
  WP05: { x: 0.395, y: 0.376 },
  WP06: { x: 0.501, y: 0.143 },
  WP07: { x: 0.604, y: 0.462 },
  WP08: { x: 0.32, y: 0.676 },
  WP09: { x: 0.484, y: 0.676 },
  WP10: { x: 0.604, y: 0.692 },
  WP11: { x: 0.767, y: 0.227 },
  WP12: { x: 0.906, y: 0.227 },
  WP13: { x: 0.763, y: 0.518 },
  WP14: { x: 0.896, y: 0.537 },
  WP15: { x: 0.827, y: 0.754 },
};
// Horizontal extent of each floor's drawing, used to dim the other floor.
export const floorRegions: Record<number, { left: number; right: number }> = {
  1: { left: 0, right: 0.676 },
  2: { left: 0.678, right: 1 },
};
