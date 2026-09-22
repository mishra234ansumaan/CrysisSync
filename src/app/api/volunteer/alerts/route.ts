/** Poll-backed volunteer notification fallback persisted in PostgreSQL. */
import { NextResponse } from "next/server";
import {
  getSosReport,
  getVolunteer,
  listVolunteerOpenMatches,
} from "@/lib/repository";
import { haversineMeters } from "@/lib/geo";

export async function GET(req: Request) {
  const volunteerId = new URL(req.url).searchParams.get("volunteerId");
  if (!volunteerId) return NextResponse.json({ error: "volunteerId required" }, { status: 400 });

  const [matches, volunteer] = await Promise.all([
    listVolunteerOpenMatches(volunteerId),
    getVolunteer(volunteerId),
  ]);
  const enriched = await Promise.all(
    matches.map(async (match) => {
      const sos = await getSosReport(match.sosId);
      if (!sos || sos.status === "resolved") return null;
      return {
        matchId: match.id,
        status: match.status,
        createdAt: match.createdAt,
        sos,
        distanceMeters: volunteer
          ? Math.round(
              haversineMeters(
                { lat: volunteer.latitude, lng: volunteer.longitude },
                { lat: sos.latitude, lng: sos.longitude }
              )
            )
          : null,
      };
    })
  );
  return NextResponse.json({
    ok: true,
    alerts: enriched
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => Number(b.status === "accepted") - Number(a.status === "accepted")),
  });
}
