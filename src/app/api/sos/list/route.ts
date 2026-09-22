/** GET /api/sos/list — live Command Center feed from the active repository. */
import { NextResponse } from "next/server";
import { listSosReports } from "@/lib/repository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const minSeverity = Number(searchParams.get("minSeverity") ?? 0);
  const verified = searchParams.get("verified");
  const includeFake = searchParams.get("includeFake") === "1";

  let rows = (await listSosReports()).slice(0, 200);
  if (!includeFake) rows = rows.filter((r) => !r.isFake);
  if (type && type !== "all") rows = rows.filter((r) => r.emergencyType === type);
  if (minSeverity > 0) rows = rows.filter((r) => r.severity >= minSeverity);
  if (verified === "true") rows = rows.filter((r) => r.isVerified);
  if (verified === "false") rows = rows.filter((r) => !r.isVerified);

  return NextResponse.json({ ok: true, reports: rows });
}
