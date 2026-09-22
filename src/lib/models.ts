/**
 * Provider-neutral CrisisSync domain models.
 *
 * API routes and UI import these interfaces instead of an ORM-specific type.
 * The production repository stores them in Supabase PostgreSQL; local
 * development uses the same Drizzle adapter without changing callers.
 */
export interface SOSReport {
  id: string;
  userId: string | null;
  transcript: string;
  emergencyType: string;
  severity: number;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  trustScore: number;
  isVerified: boolean;
  isFake: boolean;
  language: string;
  status: string;
  source: string;
  aiSummary: string | null;
  keywords: string | null;
  verificationNotes: string | null;
  createdAt: Date;
}

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  /** JSON string: { boat, first_aid, food, shelter, vehicle } */
  resources: string;
  isAvailable: boolean;
  createdAt: Date;
}

export interface MedicalProfile {
  id: string;
  userId: string;
  name: string;
  bloodGroup: string;
  allergies: string | null;
  conditions: string | null;
  emergencyContact: string;
  updatedAt: Date;
}

export interface RescueMatch {
  id: string;
  sosId: string;
  volunteerId: string;
  status: string;
  createdAt: Date;
}

export type SOSPatch = Partial<Omit<SOSReport, "id" | "createdAt">>;
export type MatchPatch = Partial<Omit<RescueMatch, "id" | "createdAt">>;
