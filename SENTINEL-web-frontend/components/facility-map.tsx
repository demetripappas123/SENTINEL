"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useInspectionData } from "../lib/inspection-data";
import { placeName } from "../lib/operator-copy";

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

const MIN_SCALE = 1;
const MAX_SCALE = 3.5;

type View = { scale: number; x: number; y: number };

function startingScale(width: number) {
  if (width >= 720) return 1.85;
  if (width >= 480) return 1.45;
  return 1.12;
}

function clamp(frame: HTMLElement, view: View): View {
  const maxX = (frame.clientWidth * (view.scale - 1)) / 2;
  const maxY = (frame.clientHeight * (view.scale - 1)) / 2;
  return {
    scale: view.scale,
    x: Math.min(maxX, Math.max(-maxX, view.x)),
    y: Math.min(maxY, Math.max(-maxY, view.y)),
  };
}

export type MapMark = "failed" | "passed";

export function hasMapPoint(id: string | null | undefined) {
  return !!id && id in points;
}

export function FacilityMap({
  selected,
  onSelect,
  focus = false,
  focusScale = 2.2,
  trail,
  marks,
  pin,
}: {
  selected: string;
  onSelect?: (id: string) => void;
  /** Pan and zoom so the selected waypoint sits in the middle of the frame. */
  focus?: boolean;
  focusScale?: number;
  /** Waypoints visited in order, drawn as a route line. */
  trail?: string[];
  /** Outcome dots for waypoints already inspected. */
  marks?: Record<string, MapMark>;
  /** A pulsing pin at the selected waypoint. */
  pin?: "failed" | "passed" | "moving";
}) {
  const data = useInspectionData();
  const frame = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ scale: 1.12, x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [paint, setPaint] = useState<View>({ scale: 1.12, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  function commit(next: View) {
    const node = frame.current;
    const clamped = node ? clamp(node, next) : next;
    view.current = clamped;
    setPaint(clamped);
  }

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    commit({ ...view.current, scale: startingScale(node.clientWidth) });
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.18 : -0.18;
      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, view.current.scale + step),
      );
      commit({ ...view.current, scale });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const node = frame.current;
    const point = points[selected];
    if (!focus || !node) return;
    // With nothing to follow, step back to the whole floor plan.
    if (!point) return commit({ scale: MIN_SCALE, x: 0, y: 0 });
    const scale = Math.max(view.current.scale, focusScale);
    commit({
      scale,
      x: -(point[0] / 100 - 0.5) * node.clientWidth * scale,
      y: -(point[1] / 100 - 0.5) * node.clientHeight * scale,
    });
  }, [focus, focusScale, selected]);

  const route = (trail ?? []).filter((id) => points[id]);

  return (
    <div
      className={"map-graphic" + (dragging ? " dragging" : "")}
      ref={frame}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest(".map-zoom")) return;
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          ox: view.current.x,
          oy: view.current.y,
          moved: false,
        };
        setDragging(true);
        try {
          frame.current?.setPointerCapture(event.pointerId);
        } catch {
          /* Untrusted events cannot capture the pointer. */
        }
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (Math.hypot(dx, dy) > 4) current.moved = true;
        commit({
          ...view.current,
          x: current.ox + dx,
          y: current.oy + dy,
        });
      }}
      onPointerUp={() => {
        if (drag.current?.moved) suppressClick.current = true;
        drag.current = null;
        setDragging(false);
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="map-stage"
        style={{
          transform: `translate(${paint.x}px, ${paint.y}px) scale(${paint.scale})`,
        }}
      >
        <Image
          src="/demo/facility.jpg"
          alt="Illustrative fictional facility floor plan"
          width={1024}
          height={539}
          draggable={false}
          unoptimized
        />
        {route.length > 1 && (
          <svg className="map-trail" viewBox="0 0 1024 539" aria-hidden="true">
            <polyline
              points={route
                .map((id) => points[id][0] * 10.24 + "," + points[id][1] * 5.39)
                .join(" ")}
            />
          </svg>
        )}
        {marks &&
          Object.entries(marks)
            .filter(([id]) => points[id] && id !== selected)
            .map(([id, mark]) => (
              <span
                key={id}
                className={"map-mark " + mark}
                style={{ left: points[id][0] + "%", top: points[id][1] + "%" }}
                aria-hidden="true"
              />
            ))}
        {pin && points[selected] && (
          <span
            key={selected + pin}
            className={"map-pin " + pin}
            style={{
              left: points[selected][0] + "%",
              top: points[selected][1] + "%",
            }}
            aria-hidden="true"
          >
            <i />
          </span>
        )}
        {data.locations
          .filter((location) => points[location.location_id])
          .map((location) => (
            <button
              key={location.location_id}
              className={
                "map-hotspot " +
                (selected === location.location_id ? "active" : "")
              }
              style={{
                left: points[location.location_id][0] + "%",
                top: points[location.location_id][1] + "%",
              }}
              onClick={() => onSelect?.(location.location_id)}
              tabIndex={onSelect ? undefined : -1}
              aria-label={"Select " + placeName(data, location.location_id)}
              aria-pressed={selected === location.location_id}
              title={placeName(data, location.location_id)}
            />
          ))}
      </div>
      <div className="map-zoom">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() =>
            commit({
              ...view.current,
              scale: Math.min(MAX_SCALE, view.current.scale + 0.25),
            })
          }
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() =>
            commit({
              ...view.current,
              scale: Math.max(MIN_SCALE, view.current.scale - 0.25),
            })
          }
        >
          −
        </button>
      </div>
    </div>
  );
}
