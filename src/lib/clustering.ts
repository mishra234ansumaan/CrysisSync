/**
 * Geo clustering logic (Feature 5) — lives in geo.ts; this module preserves
 * the project structure from the spec (lib/clustering.ts).
 */
export { clusterPoints, countWithin, haversineMeters } from "./geo";
export type { ClusterResult, LatLng } from "./geo";
