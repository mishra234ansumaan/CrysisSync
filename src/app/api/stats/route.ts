/** GET /api/stats — live KPIs from Supabase/local PostgreSQL. */
import { NextResponse } from "next/server";
import { listRescueMatches, listSosReports, listVolunteers } from "@/lib/repository";

export async function GET() {
  const [sos, volunteers, matches] = await Promise.all([
    listSosReports(),
    listVolunteers(),
    listRescueMatches(),
  ]);
  const deployed = new Set(
    matches.filter((match) => match.status === "accepted").map((match) => match.volunteerId)
  ).size;
  return NextResponse.json({
    ok: true,
    stats: {
      totalActive: sos.filter((report) => report.status === "active" && !report.isFake).length,
      verified: sos.filter((report) => report.isVerified && !report.isFake && report.status !== "resolved").length,
      fakeBlocked: sos.filter((report) => report.isFake).length,
      volunteersDeployed: deployed,
      totalVolunteers: volunteers.filter((volunteer) => volunteer.isAvailable).length,
      resolved: sos.filter((report) => report.status === "resolved").length,
      dispatched: sos.filter((report) => report.status === "dispatched").length,
      pendingMatches: matches.filter((match) => match.status === "pending").length,
    },
  });
}
