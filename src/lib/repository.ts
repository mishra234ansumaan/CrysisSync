/**
 * CrisisSync persistence repository — PostgreSQL via Drizzle ORM.
 *
 * Production: Supabase PostgreSQL through its pooled DATABASE_URL.
 * Local: the bundled PostgreSQL instance through the local DATABASE_URL.
 *
 * Every API route uses this repository, keeping the application portable and
 * ensuring data survives Vercel deployments without AWS credentials.
 */
import { db } from "@/db";
import {
  sosReports,
  volunteers,
  medicalProfiles,
  matches,
  pushSubscriptions,
} from "@/db/schema";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import type {
  SOSReport,
  Volunteer,
  MedicalProfile,
  RescueMatch,
  SOSPatch,
  MatchPatch,
} from "./models";

// ───────────────────────────── SOS reports ────────────────────────────────

export async function putSosReport(report: SOSReport): Promise<SOSReport> {
  await db.insert(sosReports).values(report);
  return report;
}

export async function getSosReport(id: string): Promise<SOSReport | null> {
  const [row] = await db.select().from(sosReports).where(eq(sosReports.id, id)).limit(1);
  return row ?? null;
}

export async function listSosReports(): Promise<SOSReport[]> {
  return db.select().from(sosReports).orderBy(desc(sosReports.createdAt));
}

export async function listRecentSosReports(since: Date): Promise<SOSReport[]> {
  return db.select().from(sosReports).where(gte(sosReports.createdAt, since));
}

export async function updateSosReport(id: string, patch: SOSPatch): Promise<SOSReport | null> {
  const [row] = await db
    .update(sosReports)
    .set(patch)
    .where(eq(sosReports.id, id))
    .returning();
  return row ?? null;
}

export async function deleteAllSosReports(): Promise<void> {
  await db.delete(sosReports);
}

// ───────────────────────────── volunteers ─────────────────────────────────

export async function putVolunteer(volunteer: Volunteer): Promise<Volunteer> {
  await db.insert(volunteers).values(volunteer);
  return volunteer;
}

export async function getVolunteer(id: string): Promise<Volunteer | null> {
  const [row] = await db.select().from(volunteers).where(eq(volunteers.id, id)).limit(1);
  return row ?? null;
}

export async function listVolunteers(): Promise<Volunteer[]> {
  return db.select().from(volunteers).orderBy(desc(volunteers.createdAt));
}

export async function deleteAllVolunteers(): Promise<void> {
  await db.delete(pushSubscriptions);
  await db.delete(volunteers);
}

// ───────────────────────────── rescue matches ─────────────────────────────

export async function putRescueMatch(match: RescueMatch): Promise<RescueMatch> {
  await db.insert(matches).values(match);
  return match;
}

export async function getRescueMatch(id: string): Promise<RescueMatch | null> {
  const [row] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return row ?? null;
}

export async function listRescueMatches(): Promise<RescueMatch[]> {
  return db.select().from(matches).orderBy(desc(matches.createdAt));
}

export async function listVolunteerOpenMatches(volunteerId: string): Promise<RescueMatch[]> {
  return db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.volunteerId, volunteerId),
        or(eq(matches.status, "pending"), eq(matches.status, "accepted"))
      )
    )
    .orderBy(desc(matches.createdAt));
}

export async function updateRescueMatch(id: string, patch: MatchPatch): Promise<RescueMatch | null> {
  const [row] = await db
    .update(matches)
    .set(patch)
    .where(eq(matches.id, id))
    .returning();
  return row ?? null;
}

export async function deleteAllRescueMatches(): Promise<void> {
  await db.delete(matches);
}

// ───────────────────────────── medical profiles ───────────────────────────

export async function upsertMedicalProfile(profile: MedicalProfile): Promise<MedicalProfile> {
  const [row] = await db
    .insert(medicalProfiles)
    .values(profile)
    .onConflictDoUpdate({
      target: medicalProfiles.userId,
      set: {
        name: profile.name,
        bloodGroup: profile.bloodGroup,
        allergies: profile.allergies,
        conditions: profile.conditions,
        emergencyContact: profile.emergencyContact,
        updatedAt: profile.updatedAt,
      },
    })
    .returning();
  return row;
}

export async function getMedicalProfile(userId: string): Promise<MedicalProfile | null> {
  const [row] = await db
    .select()
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}

// ───────────────────────────── Web Push ───────────────────────────────────

export interface StoredPushSubscription {
  id: string;
  volunteerId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
}

export async function upsertPushSubscription(
  subscription: StoredPushSubscription
): Promise<StoredPushSubscription> {
  const [row] = await db
    .insert(pushSubscriptions)
    .values(subscription)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        volunteerId: subscription.volunteerId,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    })
    .returning();
  return row;
}

export async function listVolunteerPushSubscriptions(
  volunteerId: string
): Promise<StoredPushSubscription[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.volunteerId, volunteerId));
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

// ───────────────────────────── observability ──────────────────────────────

export async function repositoryHealth(): Promise<{
  provider: "supabase-postgresql" | "local-postgresql";
  connected: boolean;
}> {
  await db.execute(sql`select 1`);
  const url = process.env.DATABASE_URL ?? "";
  return {
    provider: /supabase\.(co|com)|pooler\.supabase/i.test(url)
      ? "supabase-postgresql"
      : "local-postgresql",
    connected: true,
  };
}
