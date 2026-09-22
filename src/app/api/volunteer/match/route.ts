/** Volunteer accepts/declines/completes a persistent rescue match. */
import { NextResponse } from "next/server";
import {
  getRescueMatch,
  getSosReport,
  updateRescueMatch,
  updateSosReport,
} from "@/lib/repository";

export async function POST(req: Request) {
  try {
    const { matchId, action } = (await req.json()) as { matchId?: string; action?: string };
    if (!matchId || !action) {
      return NextResponse.json({ error: "matchId and action required" }, { status: 400 });
    }
    const status = action === "accept" ? "accepted" : action === "complete" ? "completed" : "declined";
    const match = await getRescueMatch(matchId);
    if (!match) return NextResponse.json({ error: "match not found" }, { status: 404 });
    await updateRescueMatch(matchId, { status });
    const sos = await getSosReport(match.sosId);
    if (status === "accepted" && sos?.status === "active") {
      await updateSosReport(sos.id, { status: "dispatched" });
    } else if (status === "completed" && sos) {
      await updateSosReport(sos.id, { status: "resolved" });
    }
    return NextResponse.json({ ok: true, status, sos: sos ? await getSosReport(sos.id) : null });
  } catch (error) {
    console.error("[volunteer/match]", error);
    return NextResponse.json({ error: "match update failed" }, { status: 500 });
  }
}
