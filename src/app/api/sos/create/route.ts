/**
 * POST /api/sos/create — Voice SOS intake (Feature 1)
 * Body: { transcript, lat, lng, userId?, source?, imageDataUrl?, imageFileName? }
 * Runs: Gemini triage → PostgreSQL → verification → matching → Web Push.
 * Vercel-Functions-ready: stateless handler, all I/O via injected env.
 */
import { NextResponse } from "next/server";
import { createSosReport } from "@/lib/sos-service";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const limit = await enforceRateLimit(req, "sos-create", 8, 10 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many SOS submissions. Use the offline SMS fallback for a genuine emergency." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
    const body = (await req.json()) as {
      transcript?: string;
      lat?: number;
      lng?: number;
      userId?: string;
      source?: "voice" | "sms" | "beacon" | "demo" | "manual";
      imageDataUrl?: string;
      imageFileName?: string;
    };
    if (!body.transcript || typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json(
        { error: "transcript, lat and lng are required" },
        { status: 400 }
      );
    }
    const result = await createSosReport({
      transcript: body.transcript.slice(0, 2000),
      lat: body.lat,
      lng: body.lng,
      userId: body.userId,
      source: body.source ?? "voice",
      imageDataUrl: body.imageDataUrl,
      imageFileName: body.imageFileName,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[sos/create]", err);
    return NextResponse.json({ error: "failed to create SOS" }, { status: 500 });
  }
}
