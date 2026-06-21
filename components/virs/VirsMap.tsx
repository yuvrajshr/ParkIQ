"use client";

import { useEffect, useRef, useState } from "react";
import type { VirsCluster } from "@/lib/types";
import { LEVEL_COLOR } from "@/lib/heat";
import { virsColor } from "@/lib/virs/heat";
import { useIsDark } from "@/lib/hooks/useIsDark";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { loadGoogleMaps, SHARED_MAP_OPTIONS, mapStyleFor } from "@/lib/maps/googleMaps";
import MapZoomControls from "@/components/MapZoomControls";

interface Props {
  clusters: VirsCluster[];
  selectedClusterId: number | null;
  onSelect: (clusterId: number | null) => void;
}

export default function VirsMap({ clusters, selectedClusterId, onSelect }: Props) {
  const { t } = useTranslation();
  const isDark = useIsDark();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [, setTick] = useState(0);

  // Map init — mirrors MapView's hidden-projection-overlay pattern so DOM markers can be placed.
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
        maxZoom: 17,
        styles: mapStyleFor(initialDark),
      });

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

  useEffect(() => {
    map?.setOptions({ styles: mapStyleFor(isDark) });
  }, [isDark, map]);

  const project = (lat: number, lng: number) => {
    const proj = overlayRef.current?.getProjection();
    if (!proj) return { x: -9999, y: -9999 };
    const px = proj.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng));
    return px ? { x: px.x, y: px.y } : { x: -9999, y: -9999 };
  };

  const maxCount = Math.max(1, ...clusters.map((c) => c.count));

  // The single highest-risk cluster earns the breathing bloom — restraint: only one.
  const topId = clusters.reduce<{ id: number | null; v: number }>(
    (best, c) => (c.avgVirs > best.v ? { id: c.clusterId, v: c.avgVirs } : best),
    { id: null, v: -1 },
  ).id;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      <MapZoomControls map={map} />

      {map && (
        <>
          {/* Heat blooms — soft radial gradients sized by cluster volume, colored by mean VIRS.
              Rendered under the interactive markers; overlapping blooms read as a heat surface. */}
          <div className="pointer-events-none absolute inset-0 z-[900]">
            {clusters.map((c) => {
              const { x, y } = project(c.lat, c.lng);
              const color = virsColor(c.avgVirs);
              const bloom = 70 + Math.sqrt(c.count / maxCount) * 150 * (0.5 + c.avgVirs);
              return (
                <span
                  key={`bloom-${c.clusterId}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: x,
                    top: y,
                    width: bloom,
                    height: bloom,
                    background: `radial-gradient(circle, ${color}80 0%, ${color}33 40%, ${color}00 72%)`,
                    mixBlendMode: isDark ? "screen" : "multiply",
                  }}
                />
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-0 z-[1000]">
            {clusters.map((c) => {
              const { x, y } = project(c.lat, c.lng);
              const size = 12 + c.avgVirs * 18;
              const selected = c.clusterId === selectedClusterId;
              const isTop = c.clusterId === topId;
              const color = virsColor(c.avgVirs);
              return (
                <div
                  key={c.clusterId}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: x, top: y, zIndex: selected ? 20 : 1 }}
                >
                  <button
                    onClick={() => onSelect(c.clusterId)}
                    className="pointer-events-auto relative block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    aria-label={`${c.name ?? `Cluster ${c.clusterId}`}, VIRS severity ${c.severityIndex}, ${c.count} violations`}
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
                      className="block rounded-full transition-[width,height,box-shadow] duration-500 ease-out"
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
                        {c.name ?? `Cluster ${c.clusterId}`} · VIRS {c.severityIndex}
                      </span>
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
                {t("virs.legend.title")}
              </div>
              <div className="flex flex-col gap-1">
                {(["low", "mid", "high", "critical"] as const).map((level) => (
                  <div key={level} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: LEVEL_COLOR[level] }}
                    />
                    <span className="text-[11px] font-medium text-ink">{t(`virs.band.${level}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
