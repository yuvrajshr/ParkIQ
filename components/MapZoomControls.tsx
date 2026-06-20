"use client";

/**
 * Glass +/- zoom buttons for the Google maps. Google's default UI is disabled (so the basemap
 * controls don't clash with the civic chrome), so we drive zoom imperatively here. Reuses the
 * same glass tokens the old Leaflet zoom control was reskinned with.
 */
export default function MapZoomControls({ map }: { map: google.maps.Map | null }) {
  if (!map) return null;

  const nudge = (delta: number) => {
    const z = map.getZoom() ?? 12;
    map.setZoom(z + delta);
  };

  return (
    <div
      className="pointer-events-auto absolute right-3 top-3 z-[1001] flex flex-col overflow-hidden rounded-xl"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        boxShadow: "var(--shadow-float), var(--glass-edge)",
      }}
    >
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label="Zoom in"
        className="flex h-[30px] w-[30px] items-center justify-center text-[16px] font-semibold text-ink transition-colors hover:bg-[rgba(27,95,176,0.10)] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label="Zoom out"
        className="flex h-[30px] w-[30px] items-center justify-center text-[16px] font-semibold text-ink transition-colors hover:bg-[rgba(27,95,176,0.10)] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        −
      </button>
    </div>
  );
}
