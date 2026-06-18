"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Hotspot, PredictedHotspot, Warden } from "@/lib/types";
import { heatColor } from "@/lib/heat";
import { ROAD_BY_ID } from "@/lib/seed/roads";

const BENGALURU_CENTER: [number, number] = [12.955, 77.64];
const BENGALURU_ZOOM = 12;

interface Props {
  hotspots: Hotspot[];
  predictions: PredictedHotspot[];
  wardens: Warden[];
  selectedId: string | null;
  onSelect: (roadId: string) => void;
}

export default function MapView({ hotspots, predictions, wardens, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<LeafletMap | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  // map stored in state so React re-renders when it becomes available
  const [map, setMap] = useState<LeafletMap | null>(null);
  // tick increments on every pan/zoom to force overlay reproject
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Guard against double-invocation in React StrictMode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((containerRef.current as any)._leaflet_id) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    import("leaflet").then((mod) => {
      if (!containerRef.current) return;
      // Double-check after async gap
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) return;

      const L = mod.default ?? mod;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const m = L.map(containerRef.current, {
        center: BENGALURU_CENTER,
        zoom: BENGALURU_ZOOM,
        minZoom: 10,
        maxZoom: 16,
        maxBounds: [[12.7, 77.4], [13.2, 77.9]],
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        attributionControl: true,
      });

      // Top-right so it never collides with the KPI band top-left.
      L.control.zoom({ position: "topright" }).addTo(m);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(m);

      const bump = () => setTick((t) => t + 1);
      m.on("move zoom", bump);

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

  // project [lng, lat] → {x, y} pixel coords in the container
  const project = (point: [number, number]) => {
    if (!map) return { x: -9999, y: -9999 };
    const px = map.latLngToContainerPoint([point[1], point[0]]);
    return { x: px.x, y: px.y };
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
              <button
                key={h.roadId}
                onClick={() => onSelect(h.roadId)}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
                style={{ left: x, top: y }}
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
                {(selected || h.cis >= 78) && (
                  <span
                    className="tnum absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {h.name} · {h.cis}
                  </span>
                )}
              </button>
            );
          })}

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
