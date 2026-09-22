/**
 * POST /api/demo/simulate — DEMO MODE control panel backend.
 * Body: { action, lat?, lng? }
 *   "flood-cluster"   → 5 simultaneous flood SOS in one area → red danger zone
 *   "voice-sos"       → predefined voice emergency through the full AI pipeline
 *   "fake-report"     → cat meme + fire claim → AI fake detection catches it
 *   "battery-beacon"  → LAST_GASP_BEACON high-priority SOS
 *   "clear"           → wipe SOS + matches for a fresh take
 */
import { NextResponse } from "next/server";
import { createSosReport } from "@/lib/sos-service";
import { DEMO_CENTER } from "@/lib/constants";
import { deleteAllRescueMatches, deleteAllSosReports } from "@/lib/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { promises as fs } from "fs";
import path from "path";

const FLOOD_TRANSCRIPTS = [
  "Help! Water is entering our house, we are on the roof now!",
  "Paani badh raha hai! My family is trapped near the bridge!",
  "Street is completely flooded, cars floating, need rescue!",
  "Flood water up to the first floor, 5 people trapped!",
  "School van stuck in floodwater near the market, children inside!",
];

const VOICE_SOS_TRANSCRIPT =
  "Help help! There is a huge fire in our apartment building, smoke everywhere, my grandmother is trapped on the third floor. Please send help immediately!";

async function readCatMemeDataUrl(): Promise<string> {
  try {
    const p = path.join(process.cwd(), "public", "demo", "cat-meme.jpg");
    const buf = await fs.readFile(p);
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const limit = await enforceRateLimit(req, "demo-simulate", 12, 60 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Demo simulation quota reached" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      lat?: number;
      lng?: number;
    };
    const center = {
      lat: typeof body.lat === "number" ? body.lat : DEMO_CENTER.lat,
      lng: typeof body.lng === "number" ? body.lng : DEMO_CENTER.lng,
    };
    const jit = () => (Math.random() - 0.5) * 0.003;

    switch (body.action) {
      case "flood-cluster": {
        const results = [];
        for (const t of FLOOD_TRANSCRIPTS) {
          results.push(
            await createSosReport({
              transcript: t,
              lat: center.lat + jit(),
              lng: center.lng + jit(),
              source: "demo",
            })
          );
        }
        return NextResponse.json({
          ok: true,
          created: results.length,
          verified: results.filter((r) => r.verification.isVerified).length,
          message: "5 flood reports dropped — crowd clustering engaged, danger zone forming.",
        });
      }

      case "voice-sos": {
        const result = await createSosReport({
          transcript: VOICE_SOS_TRANSCRIPT,
          lat: center.lat + jit(),
          lng: center.lng + jit(),
          source: "demo",
        });
        return NextResponse.json({ ok: true, ...result });
      }

      case "fake-report": {
        const imageDataUrl = await readCatMemeDataUrl();
        const result = await createSosReport({
          transcript: "OMG massive fire at my place!! Building burning down!!! (definitely real)",
          lat: center.lat - 0.03 + jit(),
          lng: center.lng - 0.02 + jit(),
          source: "demo",
          imageDataUrl: imageDataUrl || undefined,
          imageFileName: "cat-meme.jpg",
        });
        return NextResponse.json({ ok: true, ...result });
      }

      case "battery-beacon": {
        const result = await createSosReport({
          transcript: "LAST_GASP_BEACON — battery at 5%, auto-distress signal with last known location.",
          lat: center.lat + jit(),
          lng: center.lng + jit(),
          source: "beacon",
          presetType: "other",
          presetSeverity: 9,
        });
        return NextResponse.json({ ok: true, ...result });
      }

      case "clear": {
        await deleteAllRescueMatches();
        await deleteAllSosReports();
        return NextResponse.json({ ok: true, message: "All SOS reports and matches cleared." });
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[demo/simulate]", err);
    return NextResponse.json({ error: "simulation failed" }, { status: 500 });
  }
}
