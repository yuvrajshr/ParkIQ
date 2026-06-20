"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import type { Hotspot, PredictedHotspot, Warden } from "@/lib/types";
import { heatColor, LEVEL_COLOR, LEVEL_LABEL } from "@/lib/heat";
import { ROAD_BY_ID } from "@/lib/seed/roads";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useIsDark } from "@/lib/hooks/useIsDark";
import { loadGoogleMaps, SHARED_MAP_OPTIONS, mapStyleFor } from "@/lib/maps/googleMaps";
import MapZoomControls from "@/components/MapZoomControls";

interface Props {
  hotspots: Hotspot[];
  predictions: PredictedHotspot[];
  wardens: Warden[];
  selectedId: string | null;
  onSelect: (roadId: string | null) => void;
}

export default function MapView({ hotspots, predictions, wardens, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const isDark = useIsDark();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<google.maps.Map | null>(null);
  // hidden OverlayView — the only way to get a latLng → container-pixel projection
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  // map stored in state so React re-renders when it becomes available
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // tick increments on every pan/zoom to force overlay reproject
  const [, setTick] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const bump = () => setTick((t) => t + 1);

    loadGoogleMaps().then((maps) => {
      if (cancelled) return;

      const initialDark = document.documentElement.classList.contains("dark");
      const m = new maps.Map(container, {
        ...SHARED_MAP_OPTIONS,
        maxZoom: 16,
        styles: mapStyleFor(initialDark),
      });

      // A no-op overlay attached to the map exposes getProjection() for our DOM markers.
      // Its first draw() fires once projection is ready so markers never render at (-9999).
      class ProjectionOverlay extends maps.OverlayView {
        onAdd() {}
        draw() {
          bump();
        }
        onRemove() {}
      }
      const overlay = new ProjectionOverlay();
      overlay.setMap(m);
      overlayRef.current = overlay;

      // bounds_changed fires continuously through pan + zoom (replaces Leaflet "move zoom").
      m.addListener("bounds_changed", bump);
      m.addListener("click", () => onSelect(null));

      roRef.current = new ResizeObserver(() => bump());
      roRef.current.observe(container);

      instanceRef.current = m;
      setMap(m);
    });

    return () => {
      cancelled = true;
      roRef.current?.disconnect();
      roRef.current = null;
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      if (instanceRef.current) {
        google.maps.event.clearInstanceListeners(instanceRef.current);
        instanceRef.current = null;
      }
      container.innerHTML = "";
      setMap(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-style the basemap when the app theme flips.
  useEffect(() => {
    map?.setOptions({ styles: mapStyleFor(isDark) });
  }, [isDark, map]);

  // project [lng, lat] → {x, y} pixel coords in the container
  const project = (point: [number, number]) => {
    const proj = overlayRef.current?.getProjection();
    if (!proj) return { x: -9999, y: -9999 };
    const px = proj.fromLatLngToContainerPixel(new google.maps.LatLng(point[1], point[0]));
    return px ? { x: px.x, y: px.y } : { x: -9999, y: -9999 };
  };

  const activePredictions = predictions.filter(
    (p) => !hotspots.find((h) => h.roadId === p.roadId && h.cis >= 68),
  );

  // The single hottest hotspot earns the breathing bloom — restraint: only one.
  const topId = hotspots.reduce<{ id: string | null; cis: number }>(
    (best, h) => (h.cis > best.cis ? { id: h.roadId, cis: h.cis } : best),
    { id: null, cis: -1 },
  ).id;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />

      <MapZoomControls map={map} />

      {map && (
        <div className="pointer-events-none absolute inset-0 z-[1000]">
          {/* Active dispatch routes — a flowing line each en-route warden travels. */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {wardens
              .filter((w) => w.status === "en_route" && w.assignedRoadId)
              .map((w) => {
                const target = ROAD_BY_ID[w.assignedRoadId!]?.point;
                if (!target) return null;
                const a = project(w.point);
                const b = project(target);
                return (
                  <line
                    key={`route-${w.id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="4 6"
                    className="dispatch-route"
                    style={{ filter: "drop-shadow(0 0 3px rgba(27,95,176,0.55))" }}
                  />
                );
              })}
          </svg>

          {/* Forecast rings */}
          {activePredictions.map((p) => {
            const { x, y } = project(p.point);
            return (
              <div
                key={`pred-${p.roadId}`}
                className="absolute"
                style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
              >
                <span className="ring-pulse absolute left-1/2 top-1/2 block h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent" />
                <span className="block h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" />
              </div>
            );
          })}

          {/* Heat hotspots */}
          {hotspots.map((h) => {
            const { x, y } = project(h.point);
            const size = 14 + (h.cis / 100) * 22;
            const selected = h.roadId === selectedId;
            const isTop = h.roadId === topId;
            const color = heatColor(h.cis);
            return (
              <div
                key={h.roadId}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: x, top: y, zIndex: selected ? 20 : 1 }}
              >
                <button
                  onClick={() => onSelect(h.roadId)}
                  className="pointer-events-auto relative block cursor-pointer rounded-full"
                  aria-label={`${h.name}, impact score ${h.cis}`}
                >
                  {isTop && (
                    <span
                      className="heat-bloom pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size * 3.2,
                        height: size * 3.2,
                        background: `radial-gradient(circle, ${color}66 0%, ${color}00 70%)`,
                      }}
                    />
                  )}
                  <span
                    className="block rounded-full transition-[width,height,background-color,box-shadow] duration-700 ease-out"
                    style={{
                      width: size,
                      height: size,
                      background: color,
                      boxShadow: `0 0 0 ${selected ? 5 : 2}px rgba(255,255,255,0.92), 0 0 0 ${selected ? 7 : 2}px ${color}55, 0 6px 14px -4px ${color}aa`,
                    }}
                  />
                </button>
                {selected && (
                  <div className="absolute left-1/2 top-full mt-1.5 flex -translate-x-1/2 flex-col items-center gap-1">
                    <span
                      className="tnum whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold shadow-sm"
                      style={{
                        background: "var(--color-surface)",
                        color: "var(--color-ink)",
                        border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                      }}
                    >
                      {h.name} · {h.cis}
                    </span>
                    <Link
                      href={`/violations/${h.roadId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-auto flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition-[transform,background-color] hover:bg-primary-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
                      style={{ background: "var(--color-primary)" }}
                    >
                      <Camera className="size-3" />
                      {t("map.seeViolations")}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}

          {/* Legend */}
          <div
            className="pointer-events-none absolute bottom-6 right-3 z-[1001] rounded-xl px-3 py-2.5"
            style={{
              background: "var(--color-surface)",
              border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              boxShadow: "0 4px 12px -4px rgba(0,0,0,0.18)",
              minWidth: 148,
            }}
          >
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-widest text-muted">
              Congestion Impact
            </div>
            <div className="flex flex-col gap-1">
              {(["low", "mid", "high", "critical"] as const).map((level) => (
                <div key={level} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: LEVEL_COLOR[level] }}
                  />
                  <span className="text-[11px] font-medium text-ink">{LEVEL_LABEL[level]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Wardens */}
          {wardens
            .filter((w) => w.status === "en_route" || w.status === "on_site")
            .map((w) => {
              const { x, y } = project(w.point);
              return (
                <div
                  key={w.id}
                  className="absolute left-0 top-0"
                  style={{
                    transform: `translate(${x - 8}px, ${y - 8}px)`,
                    transition: "transform 0.6s linear",
                  }}
                >
                  <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-2 ring-white shadow-[0_4px_10px_-2px_rgba(27,95,176,0.7)]">
                    {w.status === "on_site" ? (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
