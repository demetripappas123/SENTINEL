"use client";

import Image from "next/image";
import { useInspectionData } from "../lib/inspection-data";

const points: Record<string, [number, number]> = {
  WP01: [8.3, 75.7],
  WP02: [8.6, 52.2],
  WP03: [21.4, 40.3],
  WP04: [19.0, 14.8],
  WP05: [39.5, 38.3],
  WP06: [50.1, 14.8],
  WP07: [60.3, 46.3],
  WP08: [31.9, 68.6],
  WP09: [48.4, 68.5],
  WP10: [60.3, 69.9],
  WP11: [76.9, 23.5],
  WP12: [91.2, 23.5],
  WP13: [76.0, 51.9],
  WP14: [90.0, 54.3],
  WP15: [82.3, 76.6],
};
export function FacilityMap({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const data = useInspectionData();
  return (
    <div className="map-graphic">
      <Image
        src="/demo/facility.jpg"
        alt="Illustrative fictional facility floor plan"
        width={1024}
        height={540}
        unoptimized
      />
      {data.locations.map((l) => (
        <button
          key={l.location_id}
          className={
            "map-hotspot " + (selected === l.location_id ? "active" : "")
          }
          style={{
            left: points[l.location_id][0] + "%",
            top: points[l.location_id][1] + "%",
          }}
          onClick={() => onSelect(l.location_id)}
          aria-label={"Select " + l.location_id + ", " + l.location_name}
          aria-pressed={selected === l.location_id}
          title={l.location_id + " · " + l.location_name}
        />
      ))}
    </div>
  );
}
