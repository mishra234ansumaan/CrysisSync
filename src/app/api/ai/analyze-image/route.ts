/**
 * POST /api/ai/analyze-image — Feature 3 Layer A as a standalone endpoint
 * (used by the demo panel "Test Fake Report" and admin evidence review).
 * Body: { imageDataUrl, emergencyType, fileName? }
 */
import { NextResponse } from "next/server";
import { verifyImage } from "@/lib/gemini";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const limit = await enforceRateLimit(req, "ai-image", 10, 60 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Image analysis quota reached" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    const { imageDataUrl, emergencyType, fileName } = (await req.json()) as {
      imageDataUrl?: string;
      emergencyType?: string;
      fileName?: string;
    };
    if (!imageDataUrl || !emergencyType) {
      return NextResponse.json({ error: "imageDataUrl and emergencyType required" }, { status: 400 });
    }
    const verdict = await verifyImage(imageDataUrl, emergencyType, fileName ?? "");
    return NextResponse.json({ ok: true, verdict });
  } catch (err) {
    console.error("[ai/analyze-image]", err);
    return NextResponse.json({ error: "analysis failed" }, { status: 500 });
  }
}
