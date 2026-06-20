"use client";

import { useEffect, useRef, useState } from "react";
import type { CitizenReport } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/citizen/reportStatus";
import { useIsDark } from "@/lib/hooks/useIsDark";
import { loadGoogleMaps, SHARED_MAP_OPTIONS, mapStyleFor } from "@/lib/maps/googleMaps";
import MapZoomControls from "@/components/MapZoomControls";

interface Props {
  reports: CitizenReport[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Google map of citizen reports. Same proven technique as MapView (muted basemap, a React
 * overlay reprojected on move/zoom via a hidden OverlayView, ResizeObserver → reproject) but
 * scoped to report pins so MapView stays untouched.
 */
export default function ReportsMap({ reports, selectedId, onSelect }: Props) {
  const isDark = useIsDark();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
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

  const project = (point: [number, number]) => {
    const proj = overlayRef.current?.getProjection();
    if (!proj) return { x: -9999, y: -9999 };
    const px = proj.fromLatLngToContainerPixel(new google.maps.LatLng(point[1], point[0]));
    return px ? { x: px.x, y: px.y } : { x: -9999, y: -9999 };
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />

      <MapZoomControls map={map} />

      {map && (
        <div className="pointer-events-none absolute inset-0 z-[1000]">
          {reports.map((r) => {
            const { x, y } = project([r.lng, r.lat]);
            const selected = r.id === selectedId;
            const color = STATUS_COLOR[r.status];
            return (
              <button
                key={r.id}
                onClick={() => onSelect(r.id)}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
                style={{ left: x, top: y, zIndex: selected ? 20 : 1 }}
                aria-label={r.snappedRoadName ?? "Citizen report"}
              >
                {selected && (
                  <span
                    className="heat-bloom pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: 64,
                      height: 64,
                      background: `radial-gradient(circle, ${color}66 0%, ${color}00 70%)`,
                    }}
                  />
                )}
                <span
                  className="flex items-center justify-center rounded-full transition-[width,height,box-shadow] duration-300 ease-out"
                  style={{
                    width: selected ? 28 : 22,
                    height: selected ? 28 : 22,
                    background: color,
                    boxShadow: `0 0 0 ${selected ? 4 : 2}px rgba(255,255,255,0.92), 0 6px 14px -4px ${color}aa`,
                  }}
                >
                  <CameraGlyph size={selected ? 14 : 11} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CameraGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
