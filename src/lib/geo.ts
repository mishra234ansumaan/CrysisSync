/**
 * Geospatial math for CrisisSync — pure functions, unit-testable, no deps.
 * Used by: crowd-clustering (Feature 5), volunteer matching (Feature 4),
 * fake-detection Layer C (Feature 3).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in meters (Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface ClusterResult<T extends LatLng> {
  center: LatLng;
  members: T[];
  radiusMeters: number;
}

/**
 * Density clustering via union-find: any two points within `radiusMeters`
 * belong to the same cluster. Equivalent outcome to DBSCAN for our
 * single-linkage use case (SOS crowd-clustering at 500m).
 */
export function clusterPoints<T extends LatLng>(
  points: T[],
  radiusMeters = 500
): ClusterResult<T>[] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (haversineMeters(points[i], points[j]) <= radiusMeters) union(i, j);
    }
  }

  const groups = new Map<number, T[]>();
  points.forEach((p, i) => {
    const root = find(i);
    const arr = groups.get(root) ?? [];
    arr.push(p);
    groups.set(root, arr);
  });

  return [...groups.values()].map((members) => {
    const center = {
      lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
      lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
    };
    const radius = Math.max(
      220,
      ...members.map((m) => haversineMeters(center, m))
    );
    return { center, members, radiusMeters: radius };
  });
}

/** Count of points within radius of origin (Layer C crowd corroboration). */
export function countWithin<T extends LatLng>(
  origin: LatLng,
  points: T[],
  radiusMeters: number
): number {
  return points.filter((p) => haversineMeters(origin, p) <= radiusMeters).length;
}
