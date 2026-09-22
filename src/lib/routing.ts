/**
 * Dynamic Safe-Routing engine (Feature 6)
 * ----------------------------------------
 * Generates a walking route from A → B that AVOIDS red danger zones.
 * OSRM supplies road geometry without a key. This computational geometry
 * engine inserts hazard-avoidance waypoints and remains the offline fallback.
 */
import { haversineMeters, type LatLng } from "./geo";

export interface DangerZone extends LatLng {
  radiusMeters: number;
}

export interface SafeRoute {
  path: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  /** Number of danger zones this route actively detours around. */
  avoidedZones: number;
  /**
   * Only the inserted avoidance waypoints (no smoothing samples). These are
   * handed to a real road router so it keeps the detour while snapping to
   * streets. Passing smoothing samples instead would drag the road route back
   * onto the hazardous straight line.
   */
  detours?: LatLng[];
}

const WALK_SPEED_MS = 1.35; // ~5 km/h walking pace

/** Does segment a→b pass through circle (c, r)? */
function segmentHitsCircle(a: LatLng, b: LatLng, c: LatLng, r: number): boolean {
  // Work in a local meter projection around the circle center.
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((c.lat * Math.PI) / 180);
  const toXY = (p: LatLng) => ({
    x: (p.lng - c.lng) * mPerDegLng,
    y: (p.lat - c.lat) * mPerDegLat,
  });
  const A = toXY(a);
  const B = toXY(b);
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return haversineMeters(a, c) <= r;
  let t = -(A.x * abx + A.y * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closest = { x: A.x + t * abx, y: A.y + t * aby };
  return Math.hypot(closest.x, closest.y) <= r + 30; // 30m safety buffer
}

/** Zones that the given (road) polyline actually passes through. */
export function pathBlockingZones(path: LatLng[], zones: DangerZone[]): DangerZone[] {
  return zones.filter((zone) =>
    path.some((point) => haversineMeters(point, zone) < zone.radiusMeters)
  );
}

/** Smallest distance from any point on the path to a zone edge (negative = inside). */
export function pathClearanceMeters(path: LatLng[], zones: DangerZone[]): number {
  if (!zones.length || !path.length) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...zones.map((zone) =>
      Math.min(...path.map((point) => haversineMeters(point, zone) - zone.radiusMeters))
    )
  );
}

/**
 * Build detour waypoints for an arbitrary polyline (typically an OSRM road
 * route). For every zone the path enters, a
 * waypoint is pushed outside the hazard on the side the path approaches from,
 * so the next routing pass is forced onto streets around the danger area.
 */
export function detourWaypointsForPath(
  path: LatLng[],
  zones: DangerZone[],
  bufferMeters = 220
): LatLng[] {
  const waypoints: Array<{ index: number; point: LatLng }> = [];

  for (const zone of pathBlockingZones(path, zones)) {
    // Deepest incursion point tells us which side to swing out to.
    let deepestIndex = 0;
    let deepest = Number.POSITIVE_INFINITY;
    path.forEach((point, index) => {
      const distance = haversineMeters(point, zone);
      if (distance < deepest) {
        deepest = distance;
        deepestIndex = index;
      }
    });

    // Escape bearing: away from the zone centre, using the entry point if the
    // path runs exactly through the middle.
    const reference =
      deepest < 1
        ? path[Math.max(0, deepestIndex - Math.max(1, Math.floor(path.length / 20)))]
        : path[deepestIndex];
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos((zone.lat * Math.PI) / 180);
    let dx = (reference.lng - zone.lng) * mPerDegLng;
    let dy = (reference.lat - zone.lat) * mPerDegLat;
    const magnitude = Math.hypot(dx, dy) || 1;
    dx /= magnitude;
    dy /= magnitude;

    const distance = zone.radiusMeters + bufferMeters;
    waypoints.push({
      index: deepestIndex,
      point: {
        lat: zone.lat + (dy * distance) / mPerDegLat,
        lng: zone.lng + (dx * distance) / mPerDegLng,
      },
    });
  }

  return waypoints.sort((a, b) => a.index - b.index).map((entry) => entry.point);
}

/** Offset a point by meters east/north. */
function offsetMeters(p: LatLng, east: number, north: number): LatLng {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((p.lat * Math.PI) / 180);
  return { lat: p.lat + north / mPerDegLat, lng: p.lng + east / mPerDegLng };
}

/**
 * Build a route: start with the direct segment; for each blocking danger
 * zone, insert two waypoints skirting the circle (perpendicular detour).
 * Iterates until the path clears every zone (max 4 passes → guaranteed exit).
 */
export function computeSafeRoute(
  from: LatLng,
  to: LatLng,
  zones: DangerZone[]
): SafeRoute {
  let path: LatLng[] = [from, to];
  let avoided = 0;
  const detours: LatLng[] = [];

  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    const next: LatLng[] = [path[0]];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const blocker = zones.find((z) => segmentHitsCircle(a, b, z, z.radiusMeters));
      if (!blocker) {
        next.push(b);
        continue;
      }
      // Perpendicular detour around the blocking circle.
      const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
      const angleAB = Math.atan2(b.lat - a.lat, b.lng - a.lng);
      const perp = angleAB + Math.PI / 2;
      // Extra buffer so a road-snapped route still clears the hazard edge.
      const clearance = blocker.radiusMeters + 260;
      // Pick the side of the circle farther from its center relative to path.
      const dx = Math.cos(perp) * clearance;
      const dy = Math.sin(perp) * clearance;
      const w1 = offsetMeters(mid, dx / Math.cos((mid.lat * Math.PI) / 180), dy);
      const w2 = offsetMeters(mid, -dx / Math.cos((mid.lat * Math.PI) / 180), -dy);
      const wp =
        haversineMeters(w1, blocker) >= haversineMeters(w2, blocker) ? w1 : w2;
      next.push(wp, b);
      detours.push(wp);
      avoided++;
      changed = true;
    }
    path = next;
    if (!changed) break;
  }

  // Smooth: insert intermediate samples so the polyline reads as a route.
  const smoothed: LatLng[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    smoothed.push(a);
    const steps = Math.max(1, Math.floor(haversineMeters(a, b) / 180));
    for (let s = 1; s < steps; s++) {
      smoothed.push({
        lat: a.lat + ((b.lat - a.lat) * s) / steps,
        lng: a.lng + ((b.lng - a.lng) * s) / steps,
      });
    }
  }
  smoothed.push(path[path.length - 1]);

  const distanceMeters = smoothed
    .slice(1)
    .reduce((sum, p, i) => sum + haversineMeters(smoothed[i], p), 0);

  return {
    path: smoothed,
    distanceMeters,
    durationSeconds: Math.round(distanceMeters / WALK_SPEED_MS),
    avoidedZones: avoided,
    detours,
  };
}
