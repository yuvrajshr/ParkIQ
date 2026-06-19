"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { CitizenReport } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/citizen/reportStatus";

const BENGALURU_CENTER: [number, number] = [12.955, 77.64];
const BENGALURU_ZOOM = 12;

interface Props {
  reports: CitizenReport[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Leaflet map of citizen reports. Same proven technique as MapView (CARTO Positron
 * tiles, a React overlay reprojected on move/zoom, ResizeObserver → invalidateSize) but
 * scoped to report pins so MapView stays untouched.
 */
export default function ReportsMap({ reports, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<LeafletMap | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((containerRef.current as any)._leaflet_id) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    import("leaflet").then((mod) => {
      if (!containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) return;
      const L = mod.default ?? mod;

      const m = L.map(containerRef.current, {
        center: BENGALURU_CENTER,
        zoom: BENGALURU_ZOOM,
        minZoom: 10,
        maxZoom: 17,
        maxBounds: [[12.7, 77.4], [13.2, 77.9]],
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        attributionControl: true,
      });
      L.control.zoom({ position: "topright" }).addTo(m);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(m);

      const bump = () => setTick((t) => t + 1);
      m.on("move zoom", bump);
      m.on("click", () => onSelect(null));

      roRef.current = new ResizeObserver(() => {
        m.invalidateSize();
        bump();
      });
      roRef.current.observe(containerRef.current);

      instanceRef.current = m;
      setMap(m);
    });

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
        setMap(null);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const project = (point: [number, number]) => {
    if (!map) return { x: -9999, y: -9999 };
    const px = map.latLngToContainerPoint([point[1], point[0]]);
    return { x: px.x, y: px.y };
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />

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
