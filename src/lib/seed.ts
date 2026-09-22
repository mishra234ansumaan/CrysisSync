/** Seed 20 SOS reports + 8 volunteers into the selected repository. */
import { cuid } from "./utils";
import { buildSeedReports, buildSeedVolunteers } from "./seed-data";
import {
  deleteAllRescueMatches,
  deleteAllSosReports,
  deleteAllVolunteers,
  listSosReports,
  putSosReport,
  putVolunteer,
} from "./repository";

export async function seedDatabase(force = false) {
  const existing = await listSosReports();
  if (existing.length > 0 && !force) {
    return { seeded: false, message: "Database already has data.", reports: existing.length };
  }
  if (force) {
    await deleteAllRescueMatches();
    await deleteAllSosReports();
    await deleteAllVolunteers();
  }

  const reports = buildSeedReports();
  for (const report of reports) {
    await putSosReport({
      id: cuid(),
      userId: "seed",
      transcript: report.transcript,
      emergencyType: report.emergencyType,
      severity: report.severity,
      latitude: report.latitude,
      longitude: report.longitude,
      imageUrl: null,
      trustScore: report.trustScore,
      isVerified: report.isVerified,
      isFake: report.isFake,
      language: report.language,
      status: report.status,
      source: report.source,
      aiSummary: report.aiSummary,
      keywords: "[]",
      verificationNotes: null,
      createdAt: new Date(Date.now() - report.minutesAgo * 60_000),
    });
  }

  const volunteers = buildSeedVolunteers();
  for (const volunteer of volunteers) {
    await putVolunteer({ id: cuid(), ...volunteer, createdAt: new Date() });
  }
  return { seeded: true, reports: reports.length, volunteers: volunteers.length };
}
