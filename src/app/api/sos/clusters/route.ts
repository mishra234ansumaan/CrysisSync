/** Feature 5: live smart crowd clusters from persistent SOS records. */
import { NextResponse } from "next/server";
import { listSosReports } from "@/lib/repository";
import { clusterPoints } from "@/lib/clustering";

export async function GET() {
  const rows = (await listSosReports()).filter((r) => !r.isFake && r.status === "active");
  const clusters = clusterPoints(
    rows.map((r) => ({ ...r, lat: r.latitude, lng: r.longitude })),
    500
  ).map((cluster) => {
    const verified = cluster.members.filter((member) => member.isVerified).length;
    return {
      center: cluster.center,
      radiusMeters: cluster.radiusMeters,
      count: cluster.members.length,
      maxSeverity: Math.max(...cluster.members.map((member) => member.severity)),
      avgSeverity: Math.round(
        cluster.members.reduce((sum, member) => sum + member.severity, 0) /
          cluster.members.length
      ),
      verifiedPct: Math.round((verified / cluster.members.length) * 100),
      types: [...new Set(cluster.members.map((member) => member.emergencyType))],
      isDangerZone: cluster.members.length >= 3,
      reportIds: cluster.members.map((member) => member.id),
    };
  });
  return NextResponse.json({ ok: true, clusters });
}
