"use client";

/**
 * MapView — the tactical map (react-leaflet + OpenStreetMap/CARTO dark tiles).
 * Renders: SOS pins (color-coded, pulsing for critical), crowd-cluster
 * danger zones (Feature 5), safe routes (Feature 6), volunteer↔victim
 * rescue lines (Feature 4), shelters, and the user's live position.
 *
 * The visible map uses keyless OpenStreetMap tiles; safe road geometry comes
 * from the server-side OSRM route endpoint with offline fallback.
 */
import * as React from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { EMERGENCY_META, SHELTERS, type EmergencyType } from "@/lib/constants";
import type { LatLng } from "@/lib/geo";

export interface MapReport {
  id: string;
  lat: number;
  lng: number;
  type: EmergencyType | string;
  severity: number;
  verified: boolean;
  status: string;
  source?: string;
  summary?: string;
}

export interface MapZone {
  center: LatLng;
  radiusMeters: number;
  count: number;
  isDangerZone: boolean;
  maxSeverity: number;
  verifiedPct: number;
  types?: string[];
}

export interface MapVolunteer {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

export interface RescueLine {
  from: LatLng;
  to: LatLng;
  color?: string;
}

export interface EmergencyMapProps {
  center?: LatLng;
  zoom?: number;
  reports?: MapReport[];
  zones?: MapZone[];
  volunteers?: MapVolunteer[];
  userPos?: LatLng | null;
  route?: LatLng[];
  routeLabel?: string;
  /** Evacuation destination pin (Feature 6). */
  destination?: (LatLng & { name?: string }) | null;
  /** Fit the viewport to these points (used to frame a whole safe route). */
  fitTo?: LatLng[];
  lines?: RescueLine[];
  showShelters?: boolean;
  hideResolved?: boolean;
  onMapClick?: (p: LatLng) => void;
  onReportClick?: (id: string) => void;
  selectedId?: string | null;
  followUser?: boolean;
  focusPos?: LatLng | null;
  className?: string;
}

// ─────────────────────────── marker icon factory ───────────────────────────

function reportIcon(r: MapReport, selected: boolean): L.DivIcon {
  const meta = (EMERGENCY_META as Record<string, (typeof EMERGENCY_META)["flood"]>)[r.type] ?? EMERGENCY_META.other;
  const isBeacon = r.source === "beacon";
  const color = isBeacon ? "#f59e0b" : meta.color;
  const ping = r.severity >= 8 || isBeacon ? `<span class="marker-ping" style="background:${color}"></span>` : "";
  const ring = r.verified
    ? `box-shadow:0 0 0 2.5px #10b981, 0 0 16px ${color};`
    : `box-shadow:0 0 12px ${color}99;`;
  const resolved = r.status === "resolved" ? "opacity:0.35;filter:grayscale(1);" : "";
  return L.divIcon({
    className: "crisis-marker",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div class="marker-wrap" style="${resolved}${selected ? "transform:scale(1.5);" : ""}">
      ${ping}
      <span class="marker-dot" style="background:${color};${ring}${isBeacon ? "border-radius:4px;transform:rotate(45deg);" : ""}"></span>
    </div>`,
  });
}

const userIcon = L.divIcon({
  className: "crisis-marker",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div class="marker-wrap"><span class="marker-ping" style="background:#38bdf8"></span><span class="marker-dot user-dot"></span></div>`,
});

const volunteerIcon = L.divIcon({
  className: "crisis-marker",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div class="marker-wrap"><span class="marker-dot volunteer-dot"></span></div>`,
});

const shelterIcon = L.divIcon({
  className: "crisis-marker",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div class="marker-wrap"><span class="shelter-dot">H</span></div>`,
});

const destinationIcon = L.divIcon({
  className: "crisis-marker",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div class="marker-wrap"><span class="destination-pin">★</span></div>`,
});

function clusterBadgeIcon(count: number, danger: boolean): L.DivIcon {
  return L.divIcon({
    className: "crisis-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div class="cluster-badge ${danger ? "cluster-danger" : "cluster-watch"}" aria-label="${count} reports clustered">${count}</div>`,
  });
}

// ───────────────────────────── map effect hooks ────────────────────────────

function FlyTo({
  pos,
  follow,
  focusPos,
}: {
  pos: LatLng | null | undefined;
  follow: boolean;
  focusPos?: LatLng | null;
}) {
  const map = useMap();
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (!focusPos) return;
    map.flyTo([focusPos.lat, focusPos.lng], Math.max(map.getZoom(), 15), { duration: 0.9 });
  }, [focusPos, map]);
  React.useEffect(() => {
    if (!pos) return;
    if (!didInit.current) {
      map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 14));
      didInit.current = true;
    } else if (follow) {
      map.panTo([pos.lat, pos.lng], { animate: true });
    }
  }, [pos, follow, map]);
  return null;
}

/** Frames the viewport around a full route (origin → detours → destination). */
function FitBounds({ points }: { points?: LatLng[] }) {
  const map = useMap();
  const signature = points?.length
    ? `${points.length}:${points[0].lat.toFixed(4)},${points[0].lng.toFixed(4)}:${points[points.length - 1].lat.toFixed(4)},${points[points.length - 1].lng.toFixed(4)}`
    : "";
  React.useEffect(() => {
    if (!points || points.length < 2) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: true });
    // Leaflet needs a nudge when the container was hidden while mounting.
    window.setTimeout(() => map.invalidateSize(), 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);
  return null;
}

function ClickCatcher({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ───────────────────────────────── component ───────────────────────────────

export default function MapView({
  center = { lat: 17.385, lng: 78.4867 },
  zoom = 12,
  reports = [],
  zones = [],
  volunteers = [],
  userPos = null,
  route,
  routeLabel,
  destination = null,
  fitTo,
  lines = [],
  showShelters = false,
  hideResolved = false,
  onMapClick,
  onReportClick,
  selectedId = null,
  followUser = false,
  focusPos = null,
  className = "",
}: EmergencyMapProps) {
  const visibleReports = hideResolved ? reports.filter((r) => r.status !== "resolved") : reports;

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-2xl ${className}`} aria-label="Emergency map" role="application">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        zoomControl={false}
        className="h-full w-full"
        style={{ background: "#060b1c" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          crossOrigin="anonymous"
        />
        <ZoomControl position="bottomright" />
        <FlyTo pos={userPos} follow={followUser} focusPos={focusPos} />
        <FitBounds points={fitTo} />
        <ClickCatcher onClick={onMapClick} />

        {/* Feature 5 — danger / watch zones */}
        {zones.map((z, i) => (
          <React.Fragment key={`zone-${i}`}>
            <Circle
              center={[z.center.lat, z.center.lng]}
              radius={Math.max(z.radiusMeters, 260)}
              pathOptions={
                z.isDangerZone
                  ? { color: "#ef4444", weight: 2, fillColor: "#ef4444", fillOpacity: 0.16, className: "zone-pulse" }
                  : { color: "#f59e0b", weight: 1.6, fillColor: "#f59e0b", fillOpacity: 0.08, dashArray: "6 8" }
              }
            >
              <Tooltip direction="top" offset={[0, -8]} className="zone-tooltip" permanent={false}>
                <div className="text-xs font-semibold">
                  {z.count} reports in this zone · Verified {z.verifiedPct}% · Peak severity {z.maxSeverity}/10
                </div>
              </Tooltip>
            </Circle>
            {z.count >= 2 && (
              <Marker position={[z.center.lat, z.center.lng]} icon={clusterBadgeIcon(z.count, z.isDangerZone)} interactive={false} />
            )}
          </React.Fragment>
        ))}

        {/* SOS pins */}
        {visibleReports.map((r) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={reportIcon(r, selectedId === r.id)}
            eventHandlers={{ click: () => onReportClick?.(r.id) }}
          >
            {r.summary && (
              <Tooltip direction="top" offset={[0, -10]}>
                <div className="max-w-[220px] text-xs">{r.summary}</div>
              </Tooltip>
            )}
          </Marker>
        ))}

        {/* Volunteers */}
        {volunteers.map((v) => (
          <Marker key={`vol-${v.id}`} position={[v.lat, v.lng]} icon={volunteerIcon}>
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="text-xs font-semibold">{v.name} · volunteer</div>
            </Tooltip>
          </Marker>
        ))}

        {/* Shelters */}
        {showShelters &&
          SHELTERS.map((s) => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={shelterIcon}>
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-xs font-semibold">{s.name}</div>
              </Tooltip>
            </Marker>
          ))}

        {/* Feature 4 — rescue connection lines */}
        {lines.map((l, i) => (
          <Polyline
            key={`line-${i}`}
            positions={[
              [l.from.lat, l.from.lng],
              [l.to.lat, l.to.lng],
            ]}
            pathOptions={{ color: l.color ?? "#10b981", weight: 3, dashArray: "4 8", className: "rescue-line" }}
          />
        ))}

        {/* Feature 6 — safe route with casing */}
        {route && route.length > 1 && (
          <>
            <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#041211", weight: 9, opacity: 0.85 }} />
            <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#10b981", weight: 5, opacity: 0.95, className: "safe-route" }}>
              {routeLabel && (
                <Tooltip direction="center" permanent className="route-tooltip">
                  <div className="text-xs font-bold">{routeLabel}</div>
                </Tooltip>
              )}
            </Polyline>
          </>
        )}

        {/* Evacuation destination */}
        {destination && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={destinationIcon}
            zIndexOffset={900}
          >
            <Tooltip direction="top" offset={[0, -12]} permanent>
              <div className="text-xs font-bold">{destination.name ?? "Destination"}</div>
            </Tooltip>
          </Marker>
        )}

        {/* User position */}
        {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} zIndexOffset={1000} />}
      </MapContainer>

      {/* vignette for cinematic feel */}
      <div className="pointer-events-none absolute inset-0 z-[500] rounded-2xl shadow-[inset_0_0_80px_rgba(4,7,15,.7)]" />
    </div>
  );
}
