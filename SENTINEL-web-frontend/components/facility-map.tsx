"use client";

import Image from "next/image";
import { useInspectionData } from "../lib/inspection-data";

const points: Record<string, [number, number]> = {
  WP01: [8.9, 73.9],
  WP02: [8.3, 51.7],
  WP03: [21.1, 40.5],
  WP04: [19.0, 14.3],
  WP05: [39.5, 37.6],
  WP06: [50.1, 14.3],
  WP07: [60.4, 46.2],
  WP08: [32.0, 67.6],
  WP09: [48.4, 67.6],
  WP10: [60.4, 69.2],
  WP11: [76.7, 22.7],
  WP12: [90.6, 22.7],
  WP13: [76.3, 51.8],
  WP14: [89.6, 53.7],
  WP15: [82.7, 75.4],
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
        height={539}
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
