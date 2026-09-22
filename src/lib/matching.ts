/**
 * FEATURE 4 — Peer-to-Peer Micro-Rescue Matching
 * Maps an emergency to the resource it needs, then pings nearby volunteers.
 */
import { haversineMeters } from "./geo";
import type { LatLng } from "./geo";
import { EMERGENCY_META, DEFAULT_RESOURCES, type VolunteerResources } from "./constants";

export interface CandidateVolunteer {
  id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  resources: string; // JSON
  isAvailable: boolean;
}

export interface MatchedVolunteer {
  id: string;
  name: string;
  phone: string;
  distanceMeters: number;
  hasNeededResource: boolean;
}

export function parseResources(json: string): VolunteerResources {
  try {
    return { ...DEFAULT_RESOURCES, ...(JSON.parse(json) as Partial<VolunteerResources>) };
  } catch {
    return { ...DEFAULT_RESOURCES };
  }
}

/** medical → first_aid, flood → boat, fire → vehicle, earthquake → shelter, other → food */
export function neededResource(emergencyType: string): keyof VolunteerResources {
  return (EMERGENCY_META as Record<string, { resource: keyof VolunteerResources }>)[emergencyType]
    ?.resource ?? "food";
}

/**
 * Find volunteers within 2km, ranked by (has needed resource, distance).
 * Volunteers with the matching resource are always ranked first.
 */
export function matchVolunteers(
  sos: LatLng,
  emergencyType: string,
  volunteers: CandidateVolunteer[],
  radiusMeters = 2000
): MatchedVolunteer[] {
  const need = neededResource(emergencyType);
  return volunteers
    .filter((v) => v.isAvailable)
    .map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      distanceMeters: haversineMeters(sos, { lat: v.latitude, lng: v.longitude }),
      hasNeededResource: parseResources(v.resources)[need],
    }))
    .filter((v) => v.distanceMeters <= radiusMeters)
    .sort((a, b) =>
      a.hasNeededResource === b.hasNeededResource
        ? a.distanceMeters - b.distanceMeters
        : a.hasNeededResource
          ? -1
          : 1
    )
    .slice(0, 6);
}
