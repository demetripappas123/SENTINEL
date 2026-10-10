"use client";

import Image from "next/image";
import { useInspectionData } from "../lib/inspection-data";

const points: Record<string, [number, number]> = {
  WP01: [10, 76],
  WP02: [10, 52],
  WP03: [23, 38],
  WP04: [20, 14],
  WP05: [41, 36],
  WP06: [51, 14],
  WP07: [61, 46],
  WP08: [35, 67],
  WP09: [50, 67],
  WP10: [61, 70],
  WP11: [78, 22],
  WP12: [91, 23],
  WP13: [77, 53],
  WP14: [91, 58],
  WP15: [82, 79],
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
        src="/demo/facility.png"
        alt="Illustrative fictional facility floor plan"
        width={1095}
        height={593}
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
