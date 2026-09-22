/** Command Center report actions persisted to Supabase/local PostgreSQL. */
import { NextResponse } from "next/server";
import { updateSosReport } from "@/lib/repository";
import type { SOSPatch } from "@/lib/models";

export async function POST(req: Request) {
  try {
    const { id, action } = (await req.json()) as { id?: string; action?: string };
    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }
    const patch: SOSPatch = {};
    if (action === "verify") Object.assign(patch, { isVerified: true, isFake: false, trustScore: 95 });
    else if (action === "fake") Object.assign(patch, { isFake: true, isVerified: false, trustScore: 5 });
    else if (action === "dispatch") patch.status = "dispatched";
    else if (action === "resolve") patch.status = "resolved";
    else return NextResponse.json({ error: "unknown action" }, { status: 400 });

    const report = await updateSosReport(id, patch);
    if (!report) return NextResponse.json({ error: "report not found" }, { status: 404 });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("[sos/update]", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}
