/**
 * POST /api/ai/analyze-drone — Feature 8: AI aerial damage assessment.
 * Body: { imageDataUrl }  →  bounding boxes for flooded_zones,
 * trapped_people, damaged_structures, safe_landing_zones.
 */
import { NextResponse } from "next/server";
import { analyzeDroneImage } from "@/lib/gemini";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const limit = await enforceRateLimit(req, "ai-drone", 8, 60 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Drone analysis quota reached" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    const { imageDataUrl } = (await req.json()) as { imageDataUrl?: string };
    if (!imageDataUrl) {
      return NextResponse.json({ error: "imageDataUrl required" }, { status: 400 });
    }
    const findings = await analyzeDroneImage(imageDataUrl);
    return NextResponse.json({ ok: true, findings });
  } catch (err) {
    console.error("[ai/analyze-drone]", err);
    return NextResponse.json({ error: "analysis failed" }, { status: 500 });
  }
}
