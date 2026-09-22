/**
 * SOS creation pipeline — shared by voice, SMS and battery beacon ingestion.
 * Steps: AI triage → private Supabase evidence → PostgreSQL persist →
 * 3-layer verification → resource-aware matching → Web Push + in-app alerts.
 */
import { cuid, formatMeters } from "./utils";
import { triageTranscript } from "./gemini";
import { runVerificationLayers } from "./verification";
import { matchVolunteers } from "./matching";
import { uploadEvidenceImage } from "./storage";
import { sendVolunteerPush } from "./push";
import { EMERGENCY_META, type EmergencyType } from "./constants";
import {
  getSosReport,
  listRecentSosReports,
  listVolunteers,
  putRescueMatch,
  putSosReport,
  updateSosReport,
} from "./repository";
import type { SOSReport } from "./models";

export interface CreateSosInput {
  transcript: string;
  lat: number;
  lng: number;
  userId?: string;
  source?: "voice" | "sms" | "beacon" | "demo" | "manual";
  imageDataUrl?: string;
  imageFileName?: string;
  /** Skip AI triage when type/severity already known (SMS micro-codes). */
  presetType?: EmergencyType;
  presetSeverity?: number;
  presetLanguage?: string;
}

export async function createSosReport(input: CreateSosInput) {
  const id = cuid();

  // 1) AI triage (or preset from the compact offline SMS code).
  const triage = input.presetType
    ? {
        emergency_type: input.presetType,
        severity: input.presetSeverity ?? 7,
        keywords: ["sms-micro-code"],
        summary: `[SOS received via SMS micro-code] ${input.transcript}`,
        language_detected: input.presetLanguage ?? "en",
        source: "heuristic" as const,
      }
    : await triageTranscript(input.transcript);

  // 2) Evidence image → private Supabase Storage. The emergency itself is
  // still recorded if object storage is temporarily unavailable.
  let imageUrl: string | null = null;
  let storageWarning: string | null = null;
  if (input.imageDataUrl) {
    try {
      imageUrl = await uploadEvidenceImage(input.imageDataUrl, "sos");
    } catch (error) {
      storageWarning = error instanceof Error ? error.message : "Evidence upload failed";
      console.error("[sos-service] evidence storage upload failed", error);
    }
  }

  // 3) Initial persistent SOS record (Supabase PostgreSQL in production).
  const initialReport: SOSReport = {
    id,
    userId: input.userId ?? null,
    transcript: input.transcript,
    emergencyType: triage.emergency_type,
    severity: triage.severity,
    latitude: input.lat,
    longitude: input.lng,
    imageUrl,
    trustScore: 30,
    isVerified: false,
    isFake: false,
    language: triage.language_detected,
    source: input.source ?? "voice",
    aiSummary: triage.summary,
    keywords: JSON.stringify(triage.keywords),
    verificationNotes: null,
    status: "active",
    createdAt: new Date(),
  };
  await putSosReport(initialReport);

  // 4) Layer C data: reports in the last 10 minutes, including this one.
  const recent = await listRecentSosReports(new Date(Date.now() - 10 * 60 * 1000));

  // 5) Three-layer fake detection (Gemini Vision + weather + crowd cluster).
  const verification = await runVerificationLayers({
    emergencyType: triage.emergency_type,
    lat: input.lat,
    lng: input.lng,
    imageDataUrl: input.imageDataUrl ?? null,
    imageFileName: input.imageFileName,
    recentReports: recent.map((r) => ({ lat: r.latitude, lng: r.longitude })),
  });

  await updateSosReport(id, {
    trustScore: verification.trustScore,
    isVerified: verification.isVerified,
    isFake: verification.isFake,
    verificationNotes: JSON.stringify(verification.notes),
  });

  // 6) Persist peer-to-peer matches first, then send free standards-based Web
  // Push. The database match remains available through in-app polling even if
  // a device has not granted notification permission.
  let matched: ReturnType<typeof matchVolunteers> = [];
  const notificationResults: Array<{
    volunteerId: string;
    delivered: boolean;
    provider: "web-push" | "in-app";
    attempted: number;
  }> = [];
  if (!verification.isFake) {
    const allVolunteers = await listVolunteers();
    matched = matchVolunteers(
      { lat: input.lat, lng: input.lng },
      triage.emergency_type,
      allVolunteers
    );
    const meta = EMERGENCY_META[triage.emergency_type];

    for (const volunteer of matched) {
      await putRescueMatch({
        id: cuid(),
        sosId: id,
        volunteerId: volunteer.id,
        status: "pending",
        createdAt: new Date(),
      });
      const push = await sendVolunteerPush(volunteer.id, {
        title: `🆘 ${meta.label} emergency nearby`,
        body: `Neighbor ${formatMeters(volunteer.distanceMeters)} away needs help · Severity ${triage.severity}/10`,
        url: "/volunteer",
        tag: `sos-${id}`,
        data: { sosId: id, emergencyType: triage.emergency_type },
      });
      notificationResults.push({
        volunteerId: volunteer.id,
        delivered: push.delivered > 0,
        provider: push.delivered > 0 ? "web-push" : "in-app",
        attempted: push.attempted,
      });
    }
  }

  // 7) Return the fully hydrated persistent report.
  const report = await getSosReport(id);
  return {
    report: report ?? { ...initialReport, ...verification },
    triage,
    verification,
    matched,
    notifications: notificationResults,
    storageWarning,
  };
}
