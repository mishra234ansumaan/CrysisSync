/**
 * POST /api/routing/safe — real road-snapped evacuation routing (Feature 6).
 *
 * Providers, in priority order:
 *  1. Public OpenStreetMap/OSRM road router (keyless)
 *  2. Local geometric avoidance engine (always available offline)
 *
 * Avoidance is verified against the ACTUAL returned road geometry, not just the
 * straight line. If the road route still enters a danger zone, new detour
 * waypoints are generated from that geometry and the route is recalculated.
 */
import { NextResponse } from "next/server";
import {
  computeSafeRoute,
  detourWaypointsForPath,
  pathBlockingZones,
  pathClearanceMeters,
  type DangerZone,
  type SafeRoute,
} from "@/lib/routing";
import type { LatLng } from "@/lib/geo";

export const runtime = "nodejs";

type RouteBody = { from?: LatLng; to?: LatLng; zones?: DangerZone[] };

const MAX_WAYPOINTS = 20;
const MAX_ATTEMPTS = 3;

const validPoint = (point: LatLng | undefined): point is LatLng =>
  Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      point.lng >= -180 &&
      point.lng <= 180
  );

async function calculateOsrmRoute(points: LatLng[]): Promise<SafeRoute | null> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`,
    {
      headers: { "User-Agent": "CrisisSync/1.0 (emergency-response-app)" },
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    }
  );
  if (!response.ok) return null;
  const json = (await response.json()) as {
    routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: number[][] } }>;
  };
  const first = json.routes?.[0];
  const coordinates = first?.geometry?.coordinates;
  if (!first || !coordinates || coordinates.length < 2) return null;
  return {
    path: coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceMeters: Math.round(first.distance ?? 0),
    durationSeconds: Math.round(first.duration ?? 0),
    avoidedZones: 0,
  };
}

/** Calculate a keyless OpenStreetMap road route for one set of waypoints. */
async function roadRoute(
  from: LatLng,
  to: LatLng,
  waypoints: LatLng[]
): Promise<{ route: SafeRoute; provider: string } | null> {
  try {
    const osrm = await calculateOsrmRoute([from, ...waypoints, to]);
    if (osrm) return { route: osrm, provider: "openstreetmap-osrm" };
  } catch (error) {
    console.error("[routing/safe] OSRM failed", error);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RouteBody;
    if (!validPoint(body.from) || !validPoint(body.to)) {
      return NextResponse.json({ error: "valid from and to coordinates required" }, { status: 400 });
    }
    const from = body.from;
    const to = body.to;
    const zones = (body.zones ?? [])
      .filter((zone) => validPoint(zone) && Number.isFinite(zone.radiusMeters) && zone.radiusMeters > 0)
      .slice(0, 20);

    // Seed the search with straight-line avoidance waypoints.
    const geometric = computeSafeRoute(from, to, zones);
    let waypoints: LatLng[] = (geometric.detours ?? []).slice(0, MAX_WAYPOINTS);

    let best: { route: SafeRoute; provider: string; clearance: number } | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = await roadRoute(from, to, waypoints);
      if (!candidate) break;

      const clearance = pathClearanceMeters(candidate.route.path, zones);
      const blocking = pathBlockingZones(candidate.route.path, zones);
      const avoidedZones = zones.length - blocking.length;

      if (!best || clearance > best.clearance) {
        best = {
          route: { ...candidate.route, avoidedZones },
          provider: candidate.provider,
          clearance,
        };
      }

      // Road geometry is already outside every hazard — done.
      if (blocking.length === 0) {
        return NextResponse.json({
          ok: true,
          route: best.route,
          provider: best.provider,
          clearsHazards: true,
          clearanceMeters: Math.round(best.clearance),
          hazardsConsidered: zones.length,
        });
      }

      // Re-route using waypoints derived from the real road path.
      const corrective = detourWaypointsForPath(candidate.route.path, blocking, 220 + attempt * 160);
      if (!corrective.length) break;
      waypoints = [...waypoints, ...corrective].slice(0, MAX_WAYPOINTS);
    }

    if (best) {
      return NextResponse.json({
        ok: true,
        route: best.route,
        provider: best.provider,
        clearsHazards: best.clearance >= 0,
        clearanceMeters: Number.isFinite(best.clearance) ? Math.round(best.clearance) : null,
        hazardsConsidered: zones.length,
      });
    }

    // Both road routers unreachable — offline geometric detour still works.
    return NextResponse.json({
      ok: true,
      route: geometric,
      provider: "offline-geometric",
      clearsHazards: pathBlockingZones(geometric.path, zones).length === 0,
      clearanceMeters: Number.isFinite(pathClearanceMeters(geometric.path, zones))
        ? Math.round(pathClearanceMeters(geometric.path, zones))
        : null,
      hazardsConsidered: zones.length,
    });
  } catch (error) {
    console.error("[routing/safe]", error);
    return NextResponse.json({ error: "route calculation failed" }, { status: 500 });
  }
}
