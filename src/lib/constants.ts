/** Shared domain constants for CrisisSync. */

/** Demo epicenter — Hyderabad, India. */
export const DEMO_CENTER = { lat: 17.385, lng: 78.4867 } as const;

/** Rescue dispatch base used for Command Center approach routing. */
export const COMMAND_BASE = {
  name: "CrisisSync Rescue Command Base",
  lat: 17.3850,
  lng: 78.4867,
} as const;

/** Pre-defined relief shelters used by the Evacuate / safe-routing feature. */
export const SHELTERS = [
  { id: "sh-1", name: "Gachibowli Indoor Stadium Relief Camp", lat: 17.4401, lng: 78.3489 },
  { id: "sh-2", name: "LB Stadium Emergency Shelter", lat: 17.3992, lng: 78.4738 },
  { id: "sh-3", name: "Secunderabad Community Hall", lat: 17.4399, lng: 78.4983 },
  { id: "sh-4", name: "Banjara Hills School Shelter", lat: 17.4156, lng: 78.4347 },
] as const;

export type EmergencyType = "flood" | "fire" | "medical" | "earthquake" | "other";

export const EMERGENCY_META: Record<
  EmergencyType,
  { label: string; color: string; soft: string; resource: keyof VolunteerResources }
> = {
  flood: { label: "Flood", color: "#3b82f6", soft: "rgba(59,130,246,.15)", resource: "boat" },
  fire: { label: "Fire", color: "#f97316", soft: "rgba(249,115,22,.15)", resource: "vehicle" },
  medical: { label: "Medical", color: "#ef4444", soft: "rgba(239,68,68,.15)", resource: "first_aid" },
  earthquake: { label: "Earthquake", color: "#a855f7", soft: "rgba(168,85,247,.15)", resource: "shelter" },
  other: { label: "Other", color: "#f59e0b", soft: "rgba(245,158,11,.15)", resource: "food" },
};

export interface VolunteerResources {
  boat: boolean;
  first_aid: boolean;
  food: boolean;
  shelter: boolean;
  vehicle: boolean;
}

export const DEFAULT_RESOURCES: VolunteerResources = {
  boat: false,
  first_aid: false,
  food: false,
  shelter: false,
  vehicle: false,
};

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** Severity → visual urgency. */
export function severityTone(sev: number): { label: string; hex: string; cls: string } {
  if (sev >= 8) return { label: "CRITICAL", hex: "#ef4444", cls: "text-red-400 border-red-500/40 bg-red-500/10" };
  if (sev >= 5) return { label: "HIGH", hex: "#f59e0b", cls: "text-amber-400 border-amber-500/40 bg-amber-500/10" };
  return { label: "MODERATE", hex: "#10b981", cls: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" };
}
