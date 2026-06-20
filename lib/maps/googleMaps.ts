/**
 * Google Maps loader + shared config for ParkIQ.
 *
 * One memoized loader serves both maps (MapView dashboard, ReportsMap). We deliberately keep the
 * basemap muted/minimal — POIs and clutter dimmed — so the congestion heat markers stay the only
 * saturated thing on screen (replaces the old Leaflet `.leaflet-tile-pane` desaturation filter).
 * Markers themselves are React DOM overlays positioned via a hidden OverlayView's projection, so
 * no Google marker objects are used.
 */

import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let loadPromise: Promise<google.maps.MapsLibrary> | null = null;

/**
 * Load the Maps JS API once and reuse the promise across every map instance. Returns the `maps`
 * library (`Map`, `OverlayView`, …); core classes like `google.maps.LatLng` / `google.maps.event`
 * are available on the global namespace once this resolves.
 */
export function loadGoogleMaps(): Promise<google.maps.MapsLibrary> {
  if (loadPromise) return loadPromise;
  setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", v: "weekly" });
  loadPromise = importLibrary("maps");
  return loadPromise;
}

/** Options common to both maps. Per-map zoom caps and styles are merged on top at creation. */
export const SHARED_MAP_OPTIONS = {
  center: { lat: 12.955, lng: 77.64 },
  zoom: 12,
  minZoom: 10,
  restriction: {
    latLngBounds: { north: 13.2, south: 12.7, east: 77.9, west: 77.4 },
    strictBounds: false,
  },
  disableDefaultUI: true,
  gestureHandling: "greedy",
  clickableIcons: false,
  keyboardShortcuts: false,
} satisfies google.maps.MapOptions;

/** Light: near-white geometry, hidden business POIs, softened labels — heat dots are the focus. */
export const LIGHT_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#eef2f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a94a6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e1e8e2" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f4f6f8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e7ebf0" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d4dee6" }] },
];

/** Dark: geometry pulled down to the app's neutral-900/950 surfaces, labels lifted to grey. */
export const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0f0f0f" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a201b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f1f1f" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#262626" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2d2d2d" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0e12" }] },
];

export const mapStyleFor = (isDark: boolean) => (isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE);
